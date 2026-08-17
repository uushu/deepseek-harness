/**
 * 工作台环境光层（官网 Hero 大气层的 CSS 复刻）：纯黑蓝底 + 两团低频蓝色
 * 光晕 + 两条斜向光雾丝带 + 确定性粒子场 + 暗角。整层 `pointer-events: none`
 * 且 `aria-hidden`，只做呈现，不读取任何会话/业务状态。
 *
 * 只属于 harness 主题：通过 body[data-ds-theme='harness']（ThemePresenter/
 * boot-theme 写入的主题身份）门控挂载——dark/light 主题下整层不渲染，
 * 与 dark 基础色板严格隔离（评审 P0）。主题切换离开 harness 即卸载，
 * 切回时粒子场重新构建（无陈旧配色）。
 * @module @deepseek-ai/dsh-client-ui-layout
 */
import { useEffect, useState } from 'react'
import { THEME_ID_ATTRIBUTE } from './theme-presenter.ts'
import { ParticleField } from './ParticleField.tsx'
import css from './AmbientBackground.module.css'

/** 环境光层只存在的主题 id。 */
const HARNESS_THEME = 'harness'

/**
 * 渲染环境光层；非 harness 主题时返回 null（不占 DOM）。
 * @returns 位于所有列之下的纯呈现背景层，或 null。
 */
export function AmbientBackground() {
  const [active, setActive] = useState(
    () => document.body.getAttribute(THEME_ID_ATTRIBUTE) === HARNESS_THEME)
  useEffect(() => {
    const body = document.body
    const update = (): void => { setActive(body.getAttribute(THEME_ID_ATTRIBUTE) === HARNESS_THEME) }
    update()
    const observer = new MutationObserver(update)
    observer.observe(body, { attributes: true, attributeFilter: [THEME_ID_ATTRIBUTE] })
    return () => { observer.disconnect() }
  }, [])
  if (!active) return null
  return (
    <div className={css.ambient} aria-hidden="true">
      <div className={css.base} />
      <div className={css.glowPrimary} />
      <div className={css.glowSecondary} />
      <div className={css.ribbonA} />
      <div className={css.ribbonB} />
      {/* harness 即暗色：粒子固定暗色系（亮色主题不渲染本层）。 */}
      <ParticleField dark />
      <div className={css.vignette} />
    </div>
  )
}
