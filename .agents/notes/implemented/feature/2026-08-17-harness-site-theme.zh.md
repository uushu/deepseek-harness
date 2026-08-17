# Harness 官网风主题（ui-theme 内置 `harness`）

[English](2026-08-17-harness-site-theme.md) | 中文

新增第四个内置主题偏好 `harness`，把 [DeepSeek Harness 官网](https://www.deepseek.com/harness/en/) 的暗色设计语言落地为 DSH 的可选主题（token 层，不动组件结构与圆角）。

## 契约变化

- `theme-settings.ts`：`THEME_PREFERENCES = ['light', 'dark', 'system', 'harness']`。偏好持久化、schema、`isThemePreference` 自动跟随；host settings 写入沿用既有 `preference` 字段，无格式变化。
- `harness-theme.ts`（新增）：`HARNESS_THEME_ID` + `HARNESS_TOKENS`（约 90 个 `--dsw-*` alias 覆盖，单值——该主题只有 dark scheme）。
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

## 二期：官网同源视觉重构（ambient + 表面材质）

- `harness-site-tokens.ts`（新增）：token 词典单一权威来源，`harness-theme.ts` 重新导出；会话域表面按实测/规格校准（sidebar-fill rgba(6,13,23,.74)、bubble rgba(17,32,52,.72)、menu rgba(14,27,44,.96) 等）。
- `ui-layout` 新增 `AmbientBackground` + `ParticleField`：CSS 大气层（base 渐变 + 双光晕 + 丝带 + 暗角）+ 确定性粒子场（mulberry32(4176)、低频 30s 整波、DPR≤2、hidden 暂停、reduced-motion/`?visual-test=1` 冻结单帧）。AppFrame 只加分层（`isolation: isolate` + 列 z-index），不动布局求解器。
- 表面材质（`body[data-ds-dark-theme]` 作用域，不动业务状态机）：Sidebar 毛玻璃（blur 22px）、Composer 玻璃胶囊（半径 14px + blur 24px + focus 蓝辉光）、Details 渐变玻璃、用户弱气泡、工具块细边 ring、中心列半透明渐变让粒子若隐若现；chat 宽 748→780。
- 视觉规格：`docs/ui/harness-site-visual-spec.md`（中英配对，参数单一对照物）。
- 验收：ui-layout/ui-theme/ui-conversation/ui-primitives/ui-sidebar 测试全绿（含 ambient 新规格 9 例）、`tsc -b tsconfig.client.json` 通过、apps/web 构建通过；截图矩阵 1920/1440/1280/1024 × 六状态，参考图对比按规格 §8 量化验收。

## 三期：主题身份隔离 + 侧栏主题入口（评审修复）

- **主题身份**：ThemePresenter 与 boot-theme 把解析后的主题 id 写入
  `body[data-ds-theme]`（dispose/首帧同步清除/写入）；全部 harness 专属
  presentation CSS 从 `body[data-ds-dark-theme]` 改为
  `body[data-ds-theme='harness']`——dark 基础色板共享 dark 属性，此前会
  误吃 harness 的玻璃表面（评审 P0）。
- **Ambient 仅 harness**：环境光层以 `data-ds-theme='harness'` 门控挂载，
  dark/light 不渲染；切走即卸载、切回以同一 seed 重建（评审 P0）。
- **粒子**：canvas CSS 尺寸固定 100%（DPR backing buffer 分离，评审 P1）；
  移除每帧重建空间索引的邻近连线（消除 GC，评审 P1）。
- **主题入口（ThemeEntry）**：设置在侧栏设置入口旁的图标按钮（无文字），
  弹出四个内置偏好的皮肤菜单；设置的「外观」行移除。槽位
  `sidebar.footer.action` 类型在 ui-sidebar，ui-theme 因 tsc 项目引用成环
  无法引用，注册边界以 `as never` 擦除静态槽位类型检查（运行时由侧栏校验）。
- 验收：ui-theme/ui-layout/ui-sidebar/ui-conversation/ui-primitives/
  ui-settings-general 全绿（含 theme-entry 新规格 5 例、ambient 门控重写）；
  `tsc -b tsconfig.client.json` 干净；实机验证 harness 有环境层+毛玻璃、
  切 dark 后环境层卸载/毛玻璃消失、切回恢复、设置内无外观行。

## 已知边界

- `api-catalog.ts` 的 `ThemePreference` 声明是 `typeof THEME_PREFERENCES[number]` 引用，无需重新生成；`gen-cordis-api` 目前被工作区既有 session 事件文档缺参阻塞，与本次改动无关。
- token 层不含圆角（DSH 无 radius token，圆角硬编码在组件 CSS），如需更接近官网的 16–24px 圆角，需后续组件级调整。
