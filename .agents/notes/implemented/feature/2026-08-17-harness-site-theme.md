# Harness 官网风主题（ui-theme built-in `harness`）

English | [中文](2026-08-17-harness-site-theme.zh.md)

新增第四个内置主题偏好 `harness`，把 [DeepSeek Harness 官网](https://www.deepseek.com/harness/en/) 的暗色设计语言落地为 DSH 的可选主题（token 层，不动组件结构与圆角）。

## 契约变化

- `theme-settings.ts`：`THEME_PREFERENCES = ['light', 'dark', 'system', 'harness']`。偏好持久化、schema、`isThemePreference` 自动跟随；host settings 写入沿用既有 `preference` 字段，无格式变化。
- `harness-theme.ts`（新增）：`HARNESS_THEME_ID` + `HARNESS_TOKENS`（~90 个 `--dsw-*` alias 覆盖，单值——该主题只有 dark scheme）。
- `client/index.ts`：`BUILTIN_THEMES` 注册 `{ id: 'harness', colorScheme: 'dark', tokens: HARNESS_TOKENS }`。presenter 无需改动：dark scheme 自动写 `body[data-ds-dark-theme]`，tokens 自动写成 body 内联变量。
- `boot-theme.ts`：`harness` 偏好时设置 dark palette 并把 `HARNESS_TOKENS` 内联进 body style——首帧即官网风，无 dark→harness 闪变。
- `AppearanceRow`：新增第四个主题方块（`IconHarnessOutline16`，ui-primitives 新增）；`settings.theme` locales 加 `appearance.harness`（zh/en 均为 "Harness"）。
- 字体：`apps/web/public/fonts/` 自托管 7 个 woff2（DM Sans 400/500/700、Montserrat 400/500/600、Fragment Mono 400，均 SIL OFL 1.1）；`ui-theme/src/styles/base.css` 注册 `@font-face`（绝对路径 `/fonts/*.woff2`）。字体栈只被 `harness` 主题的 token 覆盖引用，其它主题不触发下载。

## 设计要点（token 映射，来自官网 dark tokens）

| 官网 token（dark） | DSH alias 覆盖 |
|---|---|
| `--ds-color-bg-page #0a0a0a` | `--dsw-alias-bg-base` |
| `--ds-color-bg-surface-1/2/3` | `--dsw-alias-bg-layer-1/2/3`（hsla 白 6%/4%/2%） |
| `--ds-color-brand #6799fe` | `--dsw-alias-brand-primary` / `state-business-primary` / `label-primary-bluish` |
| `--ds-btn-primary-bg #fff`（暗色主按钮白底黑字） | `--dsw-alias-button-primary-fill #fff` + `label-primary-foreground #0a0a0a` |
| `--ds-shadow-card`（inset 顶部高光） | `--dsw-shadow-lv3` |
| DM Sans / Montserrat / Fragment Mono | `--dsw-font-family` / markdown h1-h3 shorthand |

## 验证

- `ui-theme` + `ui-layout` 全部测试通过（122 个）；`tsc -b tsconfig.client.json` 通过；`apps/web build` 通过，dist 含 `fonts/` 与 7 条 `@font-face`。
- 视觉效果：本地对比渲染确认 harness 呈现纯黑背景、白底主按钮、品牌蓝链接。

## 已知边界

- `api-catalog.ts` 的 `ThemePreference` 声明是 `typeof THEME_PREFERENCES[number]` 引用，无需重新生成；`gen-cordis-api` 目前被工作区既有 session 事件文档缺参阻塞，与本次改动无关。
- token 层不含圆角（DSH 无 radius token，圆角硬编码在组件 CSS），如需更接近官网的 16–24px 圆角，需后续组件级调整。
