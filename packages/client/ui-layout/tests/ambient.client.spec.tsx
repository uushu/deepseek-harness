// @vitest-environment jsdom
/**
 * AmbientBackground + ParticleField 呈现层覆盖：环境光层跟随暗色属性渲染
 * 全部子层；粒子场在 jsdom 无真实 2D 上下文时安全降级，用假上下文驱动
 * 尺寸/构建/绘制/静态模式（reduced-motion 与 ?visual-test=1）/隐藏暂停/
 * resize 重建/清理等分支。二者都不读取任何会话或业务状态。
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render } from '@testing-library/react'
import { AmbientBackground } from '../src/client/AmbientBackground.tsx'
import { ParticleField } from '../src/client/ParticleField.tsx'

const DARK = 'data-ds-dark-theme'

/** 假 2D 上下文：记录调用，几何方法为空实现，颜色属性写入被记录。 */
function fakeContext(): CanvasRenderingContext2D & { calls: string[] } {
  const calls: string[] = []
  const state = { fillStyle: '', strokeStyle: '', lineWidth: 1 }
  const record = (name: string) => (...args: unknown[]) => { calls.push(`${name}:${args.length}`) }
  const ctx = {
    calls,
    setTransform: record('setTransform'),
    clearRect: record('clearRect'),
    beginPath: record('beginPath'),
    arc: record('arc'),
    fill: record('fill'),
    moveTo: record('moveTo'),
    lineTo: record('lineTo'),
    stroke: record('stroke'),
    get fillStyle() { return state.fillStyle },
    set fillStyle(v: string) { state.fillStyle = v; calls.push(`fillStyle:${v.slice(0, 24)}`) },
    get strokeStyle() { return state.strokeStyle },
    set strokeStyle(v: string) { state.strokeStyle = v; calls.push(`strokeStyle:${v}`) },
    get lineWidth() { return state.lineWidth },
    set lineWidth(v: number) { state.lineWidth = v; calls.push(`lineWidth:${v}`) },
  } as unknown as CanvasRenderingContext2D & { calls: string[] }
  return ctx
}

/** 把组件渲染进一个可控制尺寸的父容器并 stub 2D 上下文。 */
function mountParticles(size = { width: 1440, height: 900 }) {
  const ctx = fakeContext()
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx)
  const parent = document.createElement('div')
  Object.defineProperty(parent, 'clientWidth', { value: size.width, configurable: true })
  Object.defineProperty(parent, 'clientHeight', { value: size.height, configurable: true })
  const utils = render(<ParticleField dark />, { container: parent })
  return { ctx, parent, ...utils }
}

function stubRaf() {
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(
    (cb: FrameRequestCallback) => setTimeout(() => { cb(16) }, 16) as unknown as number)
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((h: number) => { clearTimeout(h) })
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  document.body.removeAttribute(DARK)
  window.history.replaceState(null, '', '/')
})

describe('AmbientBackground', () => {
  it('renders the full layer stack under the current dark attribute', () => {
    document.body.setAttribute(DARK, '')
    const { container } = render(<AmbientBackground />)
    const ambient = container.firstElementChild as HTMLElement
    expect(ambient.className).toContain('ambient')
    expect(ambient.getAttribute('aria-hidden')).toBe('true')
    expect(ambient.hasAttribute('data-dark')).toBe(true)
    // base + glowPrimary + glowSecondary + ribbonA + ribbonB + canvas + vignette
    expect(ambient.children.length).toBe(7)
    expect(ambient.querySelector('canvas')).not.toBeNull()
  })

  it('light mode omits data-dark and follows body attribute flips', async () => {
    const { container } = render(<AmbientBackground />)
    const ambient = container.firstElementChild as HTMLElement
    expect(ambient.hasAttribute('data-dark')).toBe(false)
    act(() => { document.body.setAttribute(DARK, '') })
    // MutationObserver 在微任务队列派发：冲刷一次让回调落地。
    await act(async () => { await Promise.resolve() })
    expect(ambient.hasAttribute('data-dark')).toBe(true)
    act(() => { document.body.removeAttribute(DARK) })
    await act(async () => { await Promise.resolve() })
    expect(ambient.hasAttribute('data-dark')).toBe(false)
  })
})

describe('ParticleField', () => {
  it('degrades to a silent canvas when no 2D context exists (jsdom)', () => {
    const { container, unmount } = render(<ParticleField dark />)
    expect(container.querySelector('canvas')).not.toBeNull()
    expect(() => { unmount() }).not.toThrow()
  })

  it('builds a deterministic field, starts RAF, and draws with the dark palette', () => {
    vi.useFakeTimers()
    stubRaf()
    const { ctx, unmount } = mountParticles()
    act(() => { vi.advanceTimersByTime(48) })
    expect(ctx.calls.some(c => c.startsWith('fillStyle:rgba'))).toBe(true)
    expect(ctx.calls.some(c => c.startsWith('arc:5'))).toBe(true)
    unmount()
    expect(window.cancelAnimationFrame).toHaveBeenCalled()
  })

  it('static mode (prefers-reduced-motion) draws one frozen frame without RAF', () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })))
    const raf = vi.spyOn(window, 'requestAnimationFrame')
    const { ctx } = mountParticles()
    expect(raf).not.toHaveBeenCalled()
    expect(ctx.calls.some(c => c.startsWith('arc:5'))).toBe(true)
  })

  it('?visual-test=1 freezes motion like reduced motion', () => {
    window.history.replaceState(null, '', '/?visual-test=1')
    const raf = vi.spyOn(window, 'requestAnimationFrame')
    const { ctx } = mountParticles()
    expect(raf).not.toHaveBeenCalled()
    expect(ctx.calls.some(c => c.startsWith('arc:5'))).toBe(true)
  })

  it('document.hidden pauses the loop and visibility resumes it', () => {
    vi.useFakeTimers()
    stubRaf()
    const { unmount } = mountParticles()
    Object.defineProperty(document, 'hidden', { value: true, configurable: true })
    act(() => { document.dispatchEvent(new Event('visibilitychange')) })
    expect(window.cancelAnimationFrame).toHaveBeenCalled()
    Object.defineProperty(document, 'hidden', { value: false, configurable: true })
    act(() => { document.dispatchEvent(new Event('visibilitychange')) })
    act(() => { vi.advanceTimersByTime(48) })
    expect(window.requestAnimationFrame).toHaveBeenCalled()
    unmount()
  })

  it('resize rebuilds the field deterministically and keeps drawing', () => {
    vi.useFakeTimers()
    stubRaf()
    const { ctx } = mountParticles()
    act(() => { vi.advanceTimersByTime(48) })
    const drawsBefore = ctx.calls.filter(c => c.startsWith('clearRect:4')).length
    act(() => { window.dispatchEvent(new Event('resize')) })
    act(() => { vi.advanceTimersByTime(48) })
    const drawsAfter = ctx.calls.filter(c => c.startsWith('clearRect:4')).length
    expect(drawsAfter).toBeGreaterThan(drawsBefore)
  })

  it('pointer movement only nudges the parallax target (no throw)', () => {
    vi.useFakeTimers()
    stubRaf()
    const { unmount } = mountParticles()
    act(() => { window.dispatchEvent(new PointerEvent('pointermove', { clientX: 800, clientY: 450 })) })
    act(() => { vi.advanceTimersByTime(48) })
    unmount()
  })
})
