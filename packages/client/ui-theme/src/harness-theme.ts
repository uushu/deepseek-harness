/**
 * 「Harness 官网风」内置主题（id `harness`）。
 *
 * 设计来源：https://www.deepseek.com/harness/en/ 的暗色设计语言 —— 纯黑
 * 页面底色（#0a0a0a）、品牌蓝（#6799fe）、半透明白色玻璃表面/描边、
 * 白底主按钮，以及 DM Sans / Montserrat / Fragment Mono 字体栈。
 *
 * 该主题叠加在 dark base palette 之上：颜色/字体/阴影全部以 alias token
 * 覆盖的形式提供（presenter 写成 body 内联变量，优先于 CSS 规则），
 * light / dark 两个既有主题完全不受影响。token 词典本体见
 * harness-site-tokens.ts（与官网实测值逐项对账的单一权威来源）。
 * @module @deepseek-ai/dsh-client-ui-theme
 */
import { HARNESS_SITE_TOKENS } from './harness-site-tokens.ts'

/** 主题 id（Appearance 选项与持久化偏好共用）。 */
export const HARNESS_THEME_ID = 'harness' as const

/**
 * Harness 主题的 alias token 覆盖（= HARNESS_SITE_TOKENS，见其模块文档；
 * 保留该别名以维持 boot-theme / client 注册入口的既有导入面）。
 */
export const HARNESS_TOKENS: Readonly<Record<string, string>> = HARNESS_SITE_TOKENS
