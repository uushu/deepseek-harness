# @deepseek-ai/dsh-client-ui-settings-mcp

[English](README.md) | 中文

**MCP** 设置入口的浏览器半边：Web 设置中复刻「插件」分区结构的一个分区——导航行、简介文字与两个功能持有的标签页。**MCP 配置**标签页为每台已配置的 MCP 服务器展示一张可展开卡片及其脱敏后的解析配置（服务器名、传输类型、命令/参数或端点 URL、环境变量与请求头键名、超时与重连策略）；**MCP 列表**标签页是可搜索的只读实例清单，包含 Loader 条目 id、有效启用状态与根 Fiber 阶段。两个标签页都通过 [`api-remotes`](../../api/remotes/README.md) 读取同一个 `mcpInventory/list` Remote，插件激活期间不会调用它。

该分区声明 `settings.mcp.tab` 根级列表 slot；两个标签页由本包自身注册进去，因此外壳（ui-settings-general）与设置域底座无需改动。该界面刻意只读：MCP 服务器配置位于部署的 `cordis.yml`，编辑属于单独的写路径里程碑。

## Model Experience

None, as this browser-only settings surface registers no prompt, tool, message, or provider request.

#### KV Cache effect

None; this package never assembles model input.

## Known Limitations and Deferred Work

- **只读** — 服务器卡片展示解析后的部署配置；新增、编辑或移除 MCP 服务器暂缓。
- **时间点状态** — 列表反映当前 Loader 快照；Fiber 阶段之外的连接级细节（重连中、退避次数）host 网关尚未暴露。
