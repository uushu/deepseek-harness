/**
 * 工作台环境光层（官网 Hero 大气层的 CSS 复刻）：纯黑蓝底 + 两团低频蓝色
 * 光晕 + 两条斜向光雾丝带 + 确定性粒子场 + 暗角。整层 `pointer-events: none`
 * 且 `aria-hidden`，只做呈现，不读取任何会话/业务状态；暗色主题通过
 * body[data-ds-dark-theme] 属性驱动（MutationObserver 监听，主题切换即时
 * 生效），亮色主题降为极淡的冷灰蓝氛围。
 * @module @deepseek-ai/dsh-client-ui-layout
 */
import { useEffect, useState } from 'react'
import { DARK_ATTRIBUTE } from './theme-presenter.ts'
import { ParticleField } from './ParticleField.tsx'
import css from './AmbientBackground.module.css'

/**
 * 渲染固定铺满父容器（AppFrame frame div）的环境光层。
 * @returns 位于所有列之下的纯呈现背景层。
 */
export function AmbientBackground() {
  const [dark, setDark] = useState(() => document.body.hasAttribute(DARK_ATTRIBUTE))
  useEffect(() => {
    const body = document.body
    const update = (): void => { setDark(body.hasAttribute(DARK_ATTRIBUTE)) }
    update()
    const observer = new MutationObserver(update)
    observer.observe(body, { attributes: true, attributeFilter: [DARK_ATTRIBUTE] })
    return () => { observer.disconnect() }
  }, [])
  return (
    <div className={css.ambient} data-dark={dark || undefined} aria-hidden="true">
      <div className={css.base} />
      <div className={css.glowPrimary} />
      <div className={css.glowSecondary} />
      <div className={css.ribbonA} />
      <div className={css.ribbonB} />
      <ParticleField dark={dark} />
      <div className={css.vignette} />
    </div>
  )
}
