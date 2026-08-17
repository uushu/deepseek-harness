/**
 * Deterministic low-frequency particle field (Canvas 2D, no dependencies),
 * the harness skin's ambient fabric: blue-gray dots drifting slowly across
 * the right band of the page — not a starfield, no proximity lines (per-frame
 * spatial indices were dropped for GC). Fixed seed keeps screenshots stable;
 * `prefers-reduced-motion` freezes a single frame; the canvas layout size is
 * fixed to the container (DPR scales only the backing buffer).
 * @module @deepseek-ai/dsh-client-ui-harness
 */

/** Fixed seed: pixel-stable across reloads. */
const PARTICLE_SEED = 4176
/** Static-mode wave phase (reduced motion). */
const FIXED_PHASE = 1.7
/** Full wave period: 20-40s low-frequency atmosphere. */
const WAVE_PERIOD_S = 30
/** Mouse parallax caps: x ±8 / y ±5. */
const PARALLAX_MAX = { x: 8, y: 5 }

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

interface Particle {
  u: number
  lane: number
  depth: number
  warmMix: number
  phase: number
  drift: number
  color: string
  x: number
  y: number
}

function particleCount(width: number): number {
  if (width < 768) return clamp(Math.round(width * 0.32), 250, 400)
  return clamp(Math.round(width * 1.05), 700, 2400)
}

function particleColor(warmMix: number, alpha: number): string {
  const cold = warmMix < 0.5 ? [108, 154, 215] : [127, 171, 224]
  const warm = warmMix < 0.5 ? [214, 218, 205] : [224, 226, 213]
  const mix = warmMix < 0.5 ? warmMix * 2 : (warmMix - 0.5) * 2
  const rgb = cold.map((c, i) => Math.round(lerp(c, warm[i] ?? c, mix)))
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha.toFixed(3)})`
}

function particleY(p: Particle, height: number, phase: number): number {
  return height * (
    0.18
    + Math.sin(p.u * 6.2 + phase + p.phase) * 0.105
    + p.lane * 0.28
    + Math.sin(p.u * 14.8 + p.lane * 3.1 + phase * 1.3 + p.phase) * 0.042
  )
}

function prefersReducedMotion(): boolean {
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * One mountable particle field over a container (fixed inset by the ambient
 * stylesheet). Owns its rAF, resize listener, and visibility pause; dispose
 * removes everything it attached.
 */
export class ParticleField {
  private readonly canvas: HTMLCanvasElement
  private readonly ctx: CanvasRenderingContext2D
  private readonly container: HTMLElement
  private particles: Particle[] = []
  private raf = 0
  private running = false
  private last = 0
  private wavePhase = 0
  private width = 0
  private height = 0
  private readonly parallax = { x: 0, y: 0 }
  private readonly mouse = { tx: 0, ty: 0 }
  private readonly onVisibility: () => void
  private readonly onResize: () => void
  private readonly onPointer: (e: PointerEvent) => void

  /**
   * @param container - element the canvas fills (positioned by CSS).
   */
  constructor(container: HTMLElement) {
    this.container = container
    this.canvas = document.createElement('canvas')
    // Mount the canvas up front: it must be in the DOM in both paths (a live
    // 2D context renders through it; a null context keeps it silent).
    container.appendChild(this.canvas)
    const ctx = this.canvas.getContext('2d')
    if (ctx === null) {
      // No 2D context (jsdom / headless): keep a silent canvas, no loop.
      this.ctx = undefined as unknown as CanvasRenderingContext2D
      this.onVisibility = () => {}
      this.onResize = () => {}
      this.onPointer = () => {}
      return
    }
    this.ctx = ctx
    this.sizeCanvas()
    this.build()
    if (prefersReducedMotion()) {
      this.wavePhase = FIXED_PHASE
      for (const p of this.particles) p.y = particleY(p, this.height, this.wavePhase)
      this.draw()
    } else {
      this.start()
    }
    this.onVisibility = () => {
      if (document.hidden) this.stop()
      else if (!prefersReducedMotion()) this.start()
    }
    this.onResize = () => {
      this.sizeCanvas()
      this.build()
      if (prefersReducedMotion()) {
        this.wavePhase = FIXED_PHASE
        for (const p of this.particles) p.y = particleY(p, this.height, this.wavePhase)
        this.draw()
      }
    }
    this.onPointer = (e: PointerEvent): void => {
      if (this.width === 0 || this.height === 0) return
      this.mouse.tx = ((e.clientX / this.width) - 0.5) * PARALLAX_MAX.x * 2
      this.mouse.ty = ((e.clientY / this.height) - 0.5) * PARALLAX_MAX.y * 2
    }
    document.addEventListener('visibilitychange', this.onVisibility)
    window.addEventListener('resize', this.onResize)
    window.addEventListener('pointermove', this.onPointer, { passive: true })
  }

  private sizeCanvas(): void {
    const dpr = Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, 2)
    this.width = this.container.clientWidth
    this.height = this.container.clientHeight
    this.canvas.width = Math.max(1, Math.round(this.width * dpr))
    this.canvas.height = Math.max(1, Math.round(this.height * dpr))
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    this.ctx.clearRect(0, 0, this.width, this.height)
  }

  private build(): void {
    const random = mulberry32(PARTICLE_SEED)
    const count = particleCount(this.width)
    this.particles = []
    for (let i = 0; i < count; i++) {
      const u = random()
      const lane = random()
      const depth = random()
      const warmMix = random()
      const alpha = lerp(0.018, 0.145, depth)
      const p: Particle = {
        u, lane, depth, warmMix,
        phase: random() * Math.PI * 2,
        drift: (random() - 0.5) * 6,
        color: particleColor(warmMix, alpha),
        x: this.width * (0.44 + u * 0.68),
        y: 0,
      }
      p.y = particleY(p, this.height, this.wavePhase)
      this.particles.push(p)
    }
  }

  private draw(): void {
    this.ctx.clearRect(0, 0, this.width, this.height)
    const px = this.parallax.x
    const py = this.parallax.y
    for (const p of this.particles) {
      this.ctx.fillStyle = p.color
      this.ctx.beginPath()
      this.ctx.arc(p.x + px, p.y + py, lerp(0.42, 1.05, p.depth), 0, Math.PI * 2)
      this.ctx.fill()
    }
  }

  private frame = (time: number): void => {
    if (!this.running) return
    if (this.last === 0) this.last = time
    const dt = Math.min(0.1, (time - this.last) / 1000)
    this.last = time
    this.wavePhase += dt * ((Math.PI * 2) / WAVE_PERIOD_S)
    this.parallax.x += (this.mouse.tx - this.parallax.x) * Math.min(1, dt * 3)
    this.parallax.y += (this.mouse.ty - this.parallax.y) * Math.min(1, dt * 3)
    for (const p of this.particles) {
      p.x += p.drift * dt
      const rightEdge = this.width * 1.12
      const leftEdge = this.width * 0.44
      if (p.x > rightEdge) p.x -= rightEdge - leftEdge
      else if (p.x < leftEdge) p.x += rightEdge - leftEdge
      p.y = particleY(p, this.height, this.wavePhase)
    }
    this.draw()
    this.raf = requestAnimationFrame(this.frame)
  }

  private start(): void {
    if (this.running || this.width === 0 || this.height === 0) return
    this.running = true
    this.last = 0
    this.raf = requestAnimationFrame(this.frame)
  }

  private stop(): void {
    this.running = false
    cancelAnimationFrame(this.raf)
  }

  /** Remove the canvas and every listener. */
  dispose(): void {
    this.stop()
    document.removeEventListener('visibilitychange', this.onVisibility)
    window.removeEventListener('resize', this.onResize)
    window.removeEventListener('pointermove', this.onPointer)
    this.canvas.remove()
  }
}
