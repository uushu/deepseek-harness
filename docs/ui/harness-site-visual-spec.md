# DSH Harness 官网风视觉规格（Harness Site Visual Spec）

English | [中文](harness-site-visual-spec.zh.md)

本规格固化「Harness 官网风」皮肤的最终视觉参数，是视觉验收与后续校准的单一对照物。**实现形态：独立插件** `@deepseek-ai/dsh-client-ui-harness`（`packages/client/ui-harness`）——token 覆盖走 `ctx.theme.overrideTokens`（`{light,dark}` 双色板）、CSS 以 `html[data-dsh-harness]` 门控、设置里有总开关（Plugins 卡）与模糊/浓度旋钮（外观区下方）、关闭即完全还原原生 UI。**六个核心包（ui-theme/ui-layout/ui-sidebar/ui-conversation/ui-primitives/ui-settings-general）已还原为未加皮肤前的原样**——此规格只描述皮肤参数，不再涉及核心主题注册。取值优先级固定为：

1. DeepSeek Harness 官网实测值（2026-08 抓取 `style.css` 的 `[data-theme=dark]` 块与实时页面截图采样）；
2. 本规格记录的目标参数；
3. DSH 既有 `--dsw-*` design tokens（未覆盖项）。

禁止在组件里自由发明新颜色/圆角/特效；确需调整时先改本规格并重新截图对账。

## 1. 设计语言

```
Midnight navy canvas   （深蓝黑画布）
+ very soft blue atmosphere（极柔蓝色大气光）
+ slow particle fabric  （低频粒子织物）
+ large negative space  （大量留白）
+ dark translucent technical surfaces（暗色半透明技术表面）
+ hairline cool borders （细冷边）
+ high-contrast neutral typography（高对比中性文字）
+ very sparse #6799fe accents（极少量品牌蓝强调）
+ developer-runtime information architecture（开发者运行时信息架构）
+ low-frequency restrained motion（低频克制动效）
```

禁止：紫色 AI 渐变、星空壁纸、神经网络墙纸、大量 20–30px 圆角、glow everywhere、每卡阴影、每状态彩色卡、ChatGPT/VS Code 克隆观感。

## 2. 画布与大气层（Ambient Background，ui-layout AmbientBackground）

| 层 | 参数 |
|---|---|
| base | `linear-gradient(180deg, #0a0a0a 0%, #0a0d15 46%, #070b12 100%)`（官网 bg-page #0a0a0a） |
| glowPrimary | 92vw×72vh，top -30vh right -8vw，`radial-gradient(rgba(78,126,208,.5) 0%, rgba(50,94,168,.26) 34%, rgba(20,48,90,.1) 55%, transparent 74%)`，blur 22px |
| glowSecondary | 58vw×66vh，top 12vh right -24vw，`radial-gradient(rgba(62,112,186,.24), rgba(30,60,104,.09) 48%, transparent 72%)`，blur 46px |
| ribbonA/B | 62vw×18vh / 55vw×14vh 巨大模糊体，白/蓝灰线性渐变，blur 54/68px，斜向旋转 |
| vignette | `radial-gradient(ellipse at 67% 20%, transparent 42%, rgba(3,6,11,.26) 78%, rgba(3,6,11,.55) 100%)` |
| 粒子 canvas | `position:absolute; inset:0; width/height:100%; display:block`（CSS 尺寸与 DPR backing buffer 分离） |

> 环境光层**只属于 harness 主题**：以 `body[data-ds-theme='harness']`（主题身份）门控挂载，dark/light 下整层不渲染——与 dark 基础色板严格隔离（评审 P0）。主题切换离开 harness 即卸载，切回时粒子场以同一 seed 重建。

校准收口点：`.ambient { --dsh-harness-ambient-opacity }`（AppFrame 的 AmbientBackground.module.css），截图后只改这里。

## 3. 粒子场（ParticleField）

| 参数 | 值 |
|---|---|
| 随机 | `mulberry32(4176)` 固定 seed（无 Math.random，截图像素级稳定） |
| 数量 | desktop `clamp(w*1.05, 700, 2400)`（1440→~1500，1920→~2000）；<768px `clamp(w*0.32, 250, 400)` |
| 几何 | x ∈ `w*(0.44 + u*0.68)`；y = `h*(0.18 + sin(u*6.2+t)*0.105 + lane*0.28 + sin(u*14.8+lane*3.1+t*1.3)*0.042)` |
| 半径/透明度 | `lerp(0.42, 1.05, depth)` / `lerp(0.018, 0.145, depth)`（亮色 ×0.55） |
| 颜色 | 冷 `rgb(108,154,215)`/`rgb(127,171,224)`；暖灰 `rgb(214,218,205)`/`rgb(224,226,213)`，按 warmMix 插值 |
| 运动 | 整波 30s（`phase += dt*2π/30`）；横向漂移 ±3px/s 带内回卷 |
| 视差 | 鼠标 ±8px/±5px，平滑逼近，无大幅甩动 |
| 连线 | ≥768px：18px 网格内连线，alpha 0.02（一旦像神经网络壁纸即删除） |
| 静态模式 | `prefers-reduced-motion: reduce` 或 `?visual-test=1`：固定相位单帧，无 RAF |
| 性能 | DPR ≤2；`document.hidden` 暂停 RAF；resize 同 seed 重建 |

## 4. Token 主题（ui-theme harness-site-tokens.ts）

官方 `[data-theme=dark]` 实测值（最高优先级），全部以 alias 覆盖落地：

| 角色 | 值 |
|---|---|
| 画布 `--dsw-alias-bg-base` | `#0a0a0a` |
| 表面 1/2/3 | 白 6% / 4% / 2% |
| overlay | `#262626` |
| 边框 l1..l4 | 白 6% / 12% / 16% / 24% |
| 文本 primary/secondary/description/placeholder | `#fff` / 白80% / 白50% / 白30% |
| 品牌蓝 `--dsw-alias-brand-primary` 等 | `#6799fe` |
| 主按钮 | 白底 `#fff` + 文字 `#0a0a0a` |
| hover | 白 6% |
| 输入底 | 白 8%（hover 12%） |
| 代码底 | `rgba(0,0,0,.35)` |
| 阴影 lv3 | `inset 0 1px 0 白12%, 0 12px 40px rgba(0,0,0,.45)` |

会话域表面（官网无对应物 → 本规格值）：

| token | 值 |
|---|---|
| `--dsw-specific-sidebar-fill` | `rgba(6,13,23,.74)` |
| `--dsw-specific-bubble` | `rgba(17,32,52,.72)` |
| `--dsw-specific-bubble-highlight` | `rgba(24,46,76,.84)` |
| `--dsw-specific-input-major` | `rgba(8,17,29,.9)` |
| `--dsw-specific-menu` | `rgba(14,27,44,.96)` |

## 5. 表面材质（仅 harness 主题，`body[data-ds-theme='harness']` 作用域）

> 主题身份：ThemePresenter 与 boot-theme 把解析后的主题 id 写入 `body[data-ds-theme]`。harness 专属 presentation CSS 一律以此属性作用域，绝不使用 `body[data-ds-dark-theme]`（dark 基础色板共享该属性，评审 P0）。

| 表面 | 规则 |
|---|---|
| Sidebar（SidebarRoot） | `linear-gradient(180deg, rgba(7,14,24,.8), rgba(5,11,20,.72))`；模糊 `blur(22px) saturate(112%)` 放在 `.root::before`（z:-1）层 |
| Composer（InputBar .card） | 半径 14px；`linear-gradient(180deg, rgba(11,22,37,.92), rgba(7,15,26,.94))` + 边框 `rgba(180,210,245,.105)` + 阴影 `inset 0 1px 0 rgba(255,255,255,.028), 0 28px 80px rgba(0,0,0,.32)`；模糊 `blur(24px) saturate(114%)` 放在 `.card::before` 层 |
| Composer focus | 边框 `rgba(103,158,254,.3)` + `0 0 0 1px rgba(86,134,254,.14), 0 0 44px rgba(65,118,230,.075)` |
| Details（DetailsPanel） | `linear-gradient(180deg, rgba(8,16,28,.82), rgba(6,12,21,.76))`；模糊 `blur(18px)` 放在 `.root::before` 层 |
| Settings 面板 / Modal（SettingsRoot .panel、Modal .dialog） | `rgba(12,23,38,.96)` + 边框 `rgba(180,210,245,.1)` + 阴影 `0 28px 80px rgba(0,0,0,.42)`（规范 §58；layer-2 白 4% 会让粒子场透进弹窗） |
| 用户气泡 | 半径 12px；token 底 + 边框 `rgba(176,205,235,.065)` |
| 工具表面（Terminal/Read/Search/Web/Diff .block） | `inset 0 0 0 1px rgba(176,205,235,.085)` 细边 ring |
| 中心列（AppFrame .centerCol） | `linear-gradient(180deg, rgba(5,8,14,.08), rgba(5,8,14,.38))` 让粒子若隐若现 |

> 实现约束：`backdrop-filter` 会让元素成为 `position: fixed` 后代的包含块（设置弹窗 overlay、Tooltip、portaled Menu 的定位基准）。因此模糊一律放在表面的 `::before` 层（`z-index:-1` + 表面 `isolation: isolate`），表面自身不携带 filter/transform——这是仓库既有先例（ConversationRoot 避免 transform 包含块）的延伸，已实测设置弹窗恢复视口居中 800×800、composer 菜单正常弹出。

## 5a. 设置面（ui-harness 插件）

- **Plugins 卡**（`settings.plugin.item`，id `harness`）：总开关——关闭即卸载 token 层/属性/氛围/缝线，原生 UI 原样恢复；开为默认。
- **外观区下方旋钮**（`settings.general.item`，order 11）：模糊（0–40px）与玻璃浓度（0–100，50 = 出厂）。
- 皮肤默认开启；localStorage 持久化（`dsh.ui-harness.*`）。

## 6. 几何

| 项 | 值 |
|---|---|
| chat 内容宽 `--dsh-chat-content-width` | 780px（composer = +32 = 812px） |
| composer 半径 / 高 | 14px / min 92–112px |
| 用户气泡最大宽 | min(525px, 82%) |
| 工具表面半径 | 9–12px |

## 7. 动效

- 沿用 DSH 既有：fast 100ms / normal 200ms / slow 300ms / `cubic-bezier(0.4,0,0.2,1)`；
- 页面元素静，Ambient 慢（30s 整波），反差即官网语言；
- 禁止 hover 上浮卡片 / 按钮放大 / icon 弹跳 / 常转渐变；
- `prefers-reduced-motion`：粒子冻结单帧、全部 transition/animation 关闭。

## 8. 验收

- 截图矩阵：1920×1080 / 1440×900（精调主态）/ 1280×800 / 1024×768，每尺寸覆盖 Empty / Conversation / Tools / Details / Sidebar-collapsed / Composer-focus；
- 参考图：`reference-harness-1440x900.png`、`reference-harness-1920x1080.png`（Chromium dark，1440×900/1920×1080）；
- 量化对比：画布区 luminance 差 ≤6%（实测 12 vs 12 ✓）；光晕峰值差 ≤10%（工作台光晕按「可感知但克制」校准，明显弱于 hero 流体 shader，属有意为之）；
- token 色差：每通道 ≤8 / Delta-E <5；
- 截图走 `?visual-test=1` 冻结粒子，保证确定性。
