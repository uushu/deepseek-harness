# Agent Note: Aqua 视觉皮肤插件

Status: implemented

[English](2026-08-17-harness-site-theme.md) | 中文

## Problem

Web 客户端需要一种受 DeepSeek Harness 官网启发的可选视觉风格，同时不能扩展共享主题偏好 schema，也不能把玻璃效果耦合进核心 layout、conversation、sidebar、primitives 和 settings 包。该风格还需要一个可恢复原生界面的总开关，并保持适合视觉测试的确定性行为。

## Decision

`@deepseek-ai/dsh-client-ui-harness` 以动态客户端插件形式独立拥有 Aqua 皮肤。它通过 `ctx.theme.overrideTokens` 叠加浅色与深色 token 覆盖，把呈现 CSS 和包自有缝线属性限制在已启用的层内，并通过 Cordis effects 挂载流体背景、壁纸、海洋生物、网格、聚光、按压和粒子鲸鱼效果。共享 UI 包继续保留原生主题与组件行为。

插件在 Plugins 设置区注册总开关卡片，并注册包含原生外观选项和 Aqua 控件的主题区。启用状态和调节值由浏览器本地存储拥有。大型视频 blob 使用 IndexedDB；支持的 Chromium 浏览器可以保留用户授权的 File System Access 文件句柄。Host 端保持有意的空实现，因为该功能只改变浏览器呈现。

视觉参数与截图验收标准由 [`docs/ui/harness-site-visual-spec.md`](../../../../docs/ui/harness-site-visual-spec.md) 统一维护。包内样式不会把 `backdrop-filter` 加到会为 fixed 浮层建立定位上下文的容器上；模糊效果放在隔离的伪元素中。

## Consequences

关闭或卸载插件会释放 token 层、属性、环境元素、观察器和设置注册，让界面恢复原生状态，不产生第二套共享主题实现。皮肤可以独立演进，但共享 DOM 有意变化时必须同步更新缝线标记测试。偏好只保存在浏览器本地，不通过 Host 设置同步。

验证覆盖本包客户端装载和层行为、受影响的设置与主题表面、客户端 TypeScript 图和组装后的 Web 构建。插件清单在启动时固定，因此运行中的 Web 组合在清单变化后需要重启。

## Alternatives considered

- 不采用把 `harness` 加为第四个内置主题的方案，因为它会扩展共享持久化偏好 schema，并让核心包承担呈现效果。
- 不把环境层与玻璃行为保留在共享 UI 包中，因为浅色或深色主题可能误继承皮肤专属行为。
- 不维护平行 Web shell fork，因为这会重复组合与组件所有权。
