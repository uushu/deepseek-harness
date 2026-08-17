/** `settings.harness` namespace dictionaries (the skin's settings copy). */

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'card.title': 'Harness 玻璃皮肤',
  'card.description': 'DeepSeek Harness 官网风玻璃皮肤：深海军蓝 / 冷白蓝双色板、氛围光与粒子织物。关闭即完全还原原生 UI。',
  'knobs.group': 'Harness 皮肤',
  'knobs.blur': '模糊',
  'knobs.frost': '玻璃浓度',
  'on': '开',
  'off': '关',
} satisfies Record<string, string>

/** The settings.harness namespace key union. */
export type HarnessKey = keyof typeof zh

/** English dictionary, checked complete against the zh key set. */
export const en = {
  'card.title': 'Harness Glass Skin',
  'card.description': 'DeepSeek Harness site-style glass skin: deep-sea navy / cool white-blue dual palette, ambient glow and a particle fabric. Off restores the stock UI exactly.',
  'knobs.group': 'Harness skin',
  'knobs.blur': 'Blur',
  'knobs.frost': 'Frost',
  'on': 'On',
  'off': 'Off',
} satisfies Record<HarnessKey, string>

/** Dictionary namespace owned by this plugin. */
export const NS = 'settings.harness'
