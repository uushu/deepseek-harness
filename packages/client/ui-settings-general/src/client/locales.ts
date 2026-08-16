/** Shell chrome and General-nav dictionaries; feature rows own their copy. */

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'trigger': '设置',
  'title': '设置',
  'close': '关闭',
  'openDocument': '打开配置文件',
  'openDocument.error': '无法打开配置文件',
  'general.nav': '通用设置',
  'personalization.nav': '个性化',
  'personalization.title': '个性化指令',
  'personalization.desc': '这些指令会在你执行任务时被遵循。',
  'personalization.loading': '正在加载…',
  'personalization.placeholder': '添加自定义指令...',
  'personalization.save': '保存',
  'personalization.saving': '保存中…',
  'personalization.saved': '已保存',
  'personalization.saveFailed': '保存失败：{error}',
} satisfies Record<string, string>

/** The settings namespace key union. */
export type SettingsKey = keyof typeof zh

/** English dictionary, checked complete against the zh key set. */
export const en = {
  'trigger': 'Settings',
  'title': 'Settings',
  'close': 'Close',
  'openDocument': 'Open configuration file',
  'openDocument.error': 'Could not open configuration file',
  'general.nav': 'General',
  'personalization.nav': 'Personalization',
  'personalization.title': 'Personalization instructions',
  'personalization.desc': 'These instructions are followed while you work.',
  'personalization.loading': 'Loading…',
  'personalization.placeholder': 'Add custom instructions...',
  'personalization.save': 'Save',
  'personalization.saving': 'Saving…',
  'personalization.saved': 'Saved',
  'personalization.saveFailed': 'Failed to save: {error}',
} satisfies Record<SettingsKey, string>
