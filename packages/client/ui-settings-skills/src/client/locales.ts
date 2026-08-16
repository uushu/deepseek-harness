/** Copy dictionaries for the Skills settings section. */

/** Locale keys these surfaces render. */
export type SkillsSettingsLocaleKey =
  | 'nav' | 'title' | 'intro' | 'tabs' | 'listTab' | 'configTab'
  | 'loading' | 'error' | 'retry' | 'empty' | 'noSession'
  | 'modelInvocableTag' | 'userOnlyTag' | 'provider' | 'source' | 'whenToUse'
  | 'sources' | 'skills'

/** Simplified Chinese dictionary and key source of truth. */
export const zh = {
  nav: '技能',
  title: '技能',
  intro: '查看当前项目可用的技能。',
  tabs: '技能视图',
  listTab: '技能列表',
  configTab: '技能配置',
  loading: '正在读取技能…',
  error: '暂时无法读取技能。',
  retry: '重试',
  empty: '当前项目没有可用技能。',
  noSession: '当前没有打开的会话。',
  modelInvocableTag: '模型可调用',
  userOnlyTag: '仅用户',
  provider: '提供方',
  source: '来源',
  whenToUse: '适用场景',
  sources: '来源分组',
  skills: '技能',
} satisfies Record<string, string>

/** English dictionary checked against the Chinese key set. */
export const en: Record<SkillsSettingsLocaleKey, string> = {
  nav: 'Skills',
  title: 'Skills',
  intro: 'View the skills available in the current project.',
  tabs: 'Skill views',
  listTab: 'Skill list',
  configTab: 'Skill configuration',
  loading: 'Reading skills…',
  error: 'Skills are temporarily unavailable.',
  retry: 'Retry',
  empty: 'No skills are available in the current project.',
  noSession: 'There is no open session.',
  modelInvocableTag: 'Model-invocable',
  userOnlyTag: 'User only',
  provider: 'Provider',
  source: 'Source',
  whenToUse: 'When to use',
  sources: 'By source',
  skills: 'Skills',
}
