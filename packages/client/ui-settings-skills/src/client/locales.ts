/** Copy dictionaries for the Skills settings section. */

/** Locale keys these surfaces render. */
export type SkillsSettingsLocaleKey =
  | 'nav' | 'title' | 'intro' | 'tabs' | 'listTab' | 'configTab'
  | 'loading' | 'error' | 'retry' | 'empty' | 'noSession'
  | 'modelInvocableTag' | 'userOnlyTag' | 'provider' | 'source' | 'whenToUse'
  | 'sources' | 'skills'
  | 'addSkill' | 'newSkill' | 'save' | 'saving' | 'deleteSkill' | 'cancel' | 'saved'
  | 'invalidSkill' | 'loadingBody' | 'deleteHint' | 'contentLabel' | 'nameLabel' | 'descriptionLabel'

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
  addSkill: '新建技能',
  newSkill: '新建技能',
  save: '保存',
  saving: '保存中…',
  deleteSkill: '删除',
  cancel: '取消',
  saved: '已保存，技能目录已更新。',
  invalidSkill: '请填写技能名和描述。',
  loadingBody: '正在读取正文…',
  deleteHint: '删除后该技能将不再可用。',
  contentLabel: '正文（Markdown）',
  nameLabel: '技能名',
  descriptionLabel: '描述',
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
  addSkill: 'New skill',
  newSkill: 'New skill',
  save: 'Save',
  saving: 'Saving…',
  deleteSkill: 'Delete',
  cancel: 'Cancel',
  saved: 'Saved; the skill directory is updated.',
  invalidSkill: 'Enter a skill name and description.',
  loadingBody: 'Reading body…',
  deleteHint: 'Removing the skill makes it unavailable.',
  contentLabel: 'Body (Markdown)',
  nameLabel: 'Skill name',
  descriptionLabel: 'Description',
}
