/** Copy dictionaries for the MCP servers Settings section. */

/** Locale keys these surfaces render. */
export type McpSettingsLocaleKey =
  | 'nav' | 'title' | 'intro' | 'tabs' | 'configTab' | 'inventoryTab'
  | 'loading' | 'error' | 'retry' | 'empty' | 'search' | 'emptySearch'
  | 'enabledTag' | 'disabledTag' | 'configuration' | 'cordis'
  | 'unobserved' | 'pending' | 'loadingPhase' | 'active' | 'failed' | 'unloading'
  | 'transportStdio' | 'transportHttp' | 'unparsed'
  | 'serverName' | 'command' | 'args' | 'url' | 'cwd' | 'envKeys' | 'headerKeys'
  | 'toolCallTimeoutMs' | 'failOnStartupError' | 'reconnect' | 'reconnectDisabled'
  | 'initialDelayMs' | 'maxDelayMs' | 'maxAttempts'

/** Simplified Chinese dictionary and key source of truth. */
export const zh = {
  nav: 'MCP',
  title: 'MCP',
  intro: '配置和查看本部署已配置的 MCP 服务器。',
  tabs: 'MCP 视图',
  configTab: 'MCP 配置',
  inventoryTab: 'MCP 列表',
  loading: '正在读取 MCP 服务器…',
  error: '暂时无法读取 MCP 服务器。',
  retry: '重试',
  empty: '本部署未配置 MCP 服务器。',
  search: '搜索 MCP 服务器',
  emptySearch: '没有匹配的服务器。',
  enabledTag: '已启用',
  disabledTag: '已停用',
  configuration: '配置状态',
  cordis: 'Cordis 状态',
  unobserved: '未挂载',
  pending: '等待依赖',
  loadingPhase: '加载中',
  active: '已挂载',
  failed: '挂载失败',
  unloading: '卸载中',
  transportStdio: 'stdio 子进程',
  transportHttp: 'Streamable HTTP',
  unparsed: '配置无法解析',
  serverName: '服务器名',
  command: '命令',
  args: '参数',
  url: '端点 URL',
  cwd: '工作目录',
  envKeys: '环境变量',
  headerKeys: '请求头',
  toolCallTimeoutMs: '工具调用超时（毫秒）',
  failOnStartupError: '启动失败即报错',
  reconnect: '自动重连',
  reconnectDisabled: '自动重连已停用',
  initialDelayMs: '初始延迟（毫秒）',
  maxDelayMs: '最大延迟（毫秒）',
  maxAttempts: '最大重试次数',
} satisfies Record<string, string>

/** English dictionary checked against the Chinese key set. */
export const en: Record<McpSettingsLocaleKey, string> = {
  nav: 'MCP',
  title: 'MCP',
  intro: 'Configure and inspect the MCP servers configured in this deployment.',
  tabs: 'MCP views',
  configTab: 'MCP configuration',
  inventoryTab: 'MCP list',
  loading: 'Reading MCP servers…',
  error: 'MCP servers are temporarily unavailable.',
  retry: 'Retry',
  empty: 'This deployment configures no MCP servers.',
  search: 'Search MCP servers',
  emptySearch: 'No matching servers.',
  enabledTag: 'Enabled',
  disabledTag: 'Disabled',
  configuration: 'Configuration',
  cordis: 'Cordis status',
  unobserved: 'Not mounted',
  pending: 'Waiting for dependencies',
  loadingPhase: 'Loading',
  active: 'Mounted',
  failed: 'Mount failed',
  unloading: 'Unloading',
  transportStdio: 'stdio process',
  transportHttp: 'Streamable HTTP',
  unparsed: 'Configuration could not be parsed',
  serverName: 'Server name',
  command: 'Command',
  args: 'Arguments',
  url: 'Endpoint URL',
  cwd: 'Working directory',
  envKeys: 'Environment variables',
  headerKeys: 'Request headers',
  toolCallTimeoutMs: 'Tool-call timeout (ms)',
  failOnStartupError: 'Fail on startup error',
  reconnect: 'Auto reconnect',
  reconnectDisabled: 'Auto reconnect disabled',
  initialDelayMs: 'Initial delay (ms)',
  maxDelayMs: 'Max delay (ms)',
  maxAttempts: 'Max attempts',
}
