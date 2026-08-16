/**
 * 确定性低频粒子场（Canvas 2D，无依赖）。
 *
 * 复刻官网 Hero 2D 粒子网络的气质：蓝灰点阵 + 极弱邻近连线，而不是星空/
 * 雪花/星座。要点：
 *  - 固定 seed（mulberry32(4176)）——每次刷新、每台机器粒子位置一致，
 *    visual regression 可比较；
 *  - 粒子主体集中在右侧 44%→108% 横向带、-8%→58% 纵向带，中心工作区左侧
 *    保持安静（规范 §25）；
 *  - 运动低频（整波 20~40s）、鼠标仅 ±8px/±5px 微弱视差；
 *  - 移动端降密度、关连线/视差；`prefers-reduced-motion` 与 `?visual-test=1`
 *    冻结为静态单帧（固定 phase、无 RAF）；
 *  - `document.hidden` 时暂停 RAF；DPR 封顶 2；resize 以同一 seed 重建。
 * 该组件只读 DOM 尺寸/主题属性，不读取任何会话/业务状态（纯呈现）。
 * @module @deepseek-ai/dsh-client-ui-layout
 */
import { useEffect, useRef } from 'react'

/** 固定 seed：保证每次截图稳定。 */
const PARTICLE_SEED = 4176
/** 静态模式（reduced-motion / visual-test）使用的固定波形相位。 */
const FIXED_PHASE = 1.7
/** 全波形周期（秒）：20~40s 的低频大气运动。 */
const WAVE_PERIOD_S = 30
/** 视差上限（px）：x ±8 / y ±5。 */
const PARALLAX_MAX = { x: 8, y: 5 }
/** 邻近连线距离/透明度上限（官方网络 <20px；规范 §29 默认极弱或关闭）。 */
const LINK_DIST = 18
const LINK_ALPHA = 0.02

/** mulberry32 固定 seed PRNG（无 Math.random）。 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t
const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v))

/** 单粒子预生成属性：几何与颜色由 u/lane/depth/warmMix 决定。 */
interface Particle {
  u: number
  lane: number
  depth: number
  warmMix: number
  phase: number
  drift: number
  /** 预计算好的 fillStyle（含深度 alpha 与主题系数）。 */
  color: string
  x: number
  y: number
}

/** 粒子数量随宽度自适应（1440→~1500，1920→~2000，移动端 ≤400）。 */
function particleCount(width: number): number {
  if (width < 768) return clamp(Math.round(width * 0.32), 250, 400)
  return clamp(Math.round(width * 1.05), 700, 2400)
}

/** 冷/暖两档色域（官网流体 shader 的蓝灰与暖灰），按 warmMix 插值。 */
function particleColor(warmMix: number, alpha: number): string {
  const cold = warmMix < 0.5 ? [108, 154, 215] : [127, 171, 224]
  const warm = warmMix < 0.5 ? [214, 218, 205] : [224, 226, 213]
  const mix = warmMix < 0.5 ? warmMix * 2 : (warmMix - 0.5) * 2
  const rgb = cold.map((c, i) => Math.round(lerp(c, warm[i] ?? c, mix)))
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha.toFixed(3)})`
}

function isStatic(): boolean {
  if (typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches) return true
  return typeof location !== 'undefined' && location.search.includes('visual-test=1')
}

/** 粒子纵向基准 + 双正弦波形（规范 §25 的几何公式）。 */
function particleY(p: Particle, height: number, phase: number): number {
  return height * (
    0.18
    + Math.sin(p.u * 6.2 + phase + p.phase) * 0.105
    + p.lane * 0.28
    + Math.sin(p.u * 14.8 + p.lane * 3.1 + phase * 1.3 + p.phase) * 0.042
  )
}

/**
 * 渲染粒子场画布。
 * @param props - dark 是否暗色主题（决定整体透明度与连线色温）。
 * @returns 铺满父容器的 canvas。
 */
export function ParticleField(props: { dark: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const darkRef = useRef(props.dark)
  darkRef.current = props.dark

  useEffect(() => {
    const canvas = canvasRef.current
    if (canvas === null) return
    const ctx = canvas.getContext('2d')
    if (ctx === null) return
    const parent = canvas.parentElement
    if (parent === null) return

    const staticMode = isStatic()
    let width = 0
    let height = 0
    let particles: Particle[] = []
    let raf = 0
    let running = false
    let last = 0
    let wavePhase = 0
    const mouse = { tx: 0, ty: 0 }
    const parallax = { x: 0, y: 0 }

    const sizeCanvas = (): void => {
      const dpr = Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, 2)
      width = parent.clientWidth
      height = parent.clientHeight
      canvas.width = Math.max(1, Math.round(width * dpr))
      canvas.height = Math.max(1, Math.round(height * dpr))
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, width, height)
    }

    const build = (): void => {
      const random = mulberry32(PARTICLE_SEED)
      const count = particleCount(width)
      const theme = darkRef.current ? 1 : 0.55
      particles = []
      for (let i = 0; i < count; i++) {
        const u = random()
        const lane = random()
        const depth = random()
        const warmMix = random()
        const alpha = lerp(0.018, 0.145, depth) * theme
        const p: Particle = {
          u, lane, depth, warmMix,
          phase: random() * Math.PI * 2,
          drift: (random() - 0.5) * 6,
          color: particleColor(warmMix, alpha),
          x: width * (0.44 + u * 0.68),
          y: 0,
        }
        p.y = particleY(p, height, wavePhase)
        particles.push(p)
      }
    }

    /** 单帧绘制：先连线后粒子，避免连线盖过点本身。 */
    const draw = (): void => {
      ctx.clearRect(0, 0, width, height)
      const px = parallax.x
      const py = parallax.y
      if (width >= 768) {
        const cell = LINK_DIST
        const grid = new Map<number, number[]>()
        particles.forEach((p, index) => {
          const key = Math.floor((p.x + px) / cell) * 73856093 ^ Math.floor((p.y + py) / cell) * 19349663
          const bucket = grid.get(key)
          if (bucket === undefined) grid.set(key, [index])
          else bucket.push(index)
        })
        ctx.strokeStyle = `rgba(${darkRef.current ? '127, 171, 224' : '96, 130, 180'}, ${LINK_ALPHA})`
        ctx.lineWidth = 0.6
        ctx.beginPath()
        for (const indices of grid.values()) {
          for (let a = 0; a < indices.length; a++) {
            for (let b = a + 1; b < indices.length; b++) {
              const pa = particles[indices[a] ?? -1]
              const pb = particles[indices[b] ?? -1]
              if (pa === undefined || pb === undefined) continue
              const dx = pa.x - pb.x
              const dy = pa.y - pb.y
              if (dx * dx + dy * dy <= LINK_DIST * LINK_DIST) {
                ctx.moveTo(pa.x + px, pa.y + py)
                ctx.lineTo(pb.x + px, pb.y + py)
              }
            }
          }
        }
        ctx.stroke()
      }
      for (const p of particles) {
        ctx.fillStyle = p.color
        ctx.beginPath()
        ctx.arc(p.x + px, p.y + py, lerp(0.42, 1.05, p.depth), 0, Math.PI * 2)
        ctx.fill()
      }
    }

    const frame = (time: number): void => {
      if (!running) return
      if (last === 0) last = time
      const dt = Math.min(0.1, (time - last) / 1000)
      last = time
      wavePhase += dt * ((Math.PI * 2) / WAVE_PERIOD_S)
      parallax.x += (mouse.tx - parallax.x) * Math.min(1, dt * 3)
      parallax.y += (mouse.ty - parallax.y) * Math.min(1, dt * 3)
      for (const p of particles) {
        p.x += p.drift * dt
        // 横向缓慢漂移出带后回卷，保持右侧粒子带密度稳定。
        const rightEdge = width * 1.12
        const leftEdge = width * 0.44
        if (p.x > rightEdge) p.x -= rightEdge - leftEdge
        else if (p.x < leftEdge) p.x += rightEdge - leftEdge
        p.y = particleY(p, height, wavePhase)
      }
      draw()
      raf = requestAnimationFrame(frame)
    }

    const start = (): void => {
      if (running || width === 0 || height === 0) return
      running = true
      last = 0
      raf = requestAnimationFrame(frame)
    }
    const stop = (): void => {
      running = false
      cancelAnimationFrame(raf)
    }

    const onVisibility = (): void => {
      if (document.hidden) stop()
      else if (!staticMode) start()
    }
    const onPointer = (e: PointerEvent): void => {
      if (width === 0 || height === 0) return
      mouse.tx = ((e.clientX / width) - 0.5) * PARALLAX_MAX.x * 2
      mouse.ty = ((e.clientY / height) - 0.5) * PARALLAX_MAX.y * 2
    }
    const onResize = (): void => {
      sizeCanvas()
      build()
      if (staticMode) draw()
    }

    sizeCanvas()
    build()
    if (staticMode) {
      wavePhase = FIXED_PHASE
      for (const p of particles) p.y = particleY(p, height, wavePhase)
      draw()
    } else {
      start()
    }

    window.addEventListener('pointermove', onPointer, { passive: true })
    document.addEventListener('visibilitychange', onVisibility)
    // 全视口 shell：window resize 即画布 resize（避免额外的 ResizeObserver 层）。
    window.addEventListener('resize', onResize)
    return () => {
      stop()
      window.removeEventListener('pointermove', onPointer)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  return <canvas ref={canvasRef} aria-hidden="true" />
}
