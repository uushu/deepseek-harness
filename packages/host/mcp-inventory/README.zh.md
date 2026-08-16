# @deepseek-ai/dsh-host-mcp-inventory

[English](README.md) | 中文

本部署已配置 MCP 服务器的只读 Host 投影。`McpInventoryGateway` 注册 `mcpInventory` 服务并发布一个生成的直连 Remote：`mcpInventory/list`。每次调用都直接读取 `ctx.loader.entries()`，跳过结构性 group 行与非 MCP 条目，按 Loader 顺序返回配置的 `@deepseek-ai/dsh-mcp-client` 实例。

每条目携带其 Loader 条目 id、解析后的服务器配置（投影为脱敏视图）——服务器名、传输类型（`stdio`/`streamable-http`）、命令/参数或端点 URL、工作目录、工具调用超时、启动失败策略与重连策略——以及有效启用状态和当前根 Fiber 阶段。环境变量与 header 的**值**属于机密，绝不离开宿主：投影只暴露它们的键名。

阶段为 `pending`、`loading`、`active`、`failed` 或 `unloading`；条目没有存活根 Fiber 时为 `null`。快照刻意是时间点状态：Loader 仍是唯一生命周期权威，本包不拥有缓存、历史、来源模型、事件流或变更路径。公开载荷类型位于 `./types`，Typert 生成 `./typert` 与 `./remote` 暴露的 Host 与 Client Remote 工件。

该服务仅作 Remote，刻意不声明同进程的 Cordis `Context` 合并。Client 包通过显式 [`api-remotes`](../../api/remotes/README.md) 组装消费它，而不是导入 Host 实现。

## Model Experience

None, as this Host-only inventory projection registers no prompt, tool, message, or provider request.

#### KV Cache effect

None; this package never assembles model input.

## Known Limitations and Deferred Work

- **仅时间点状态** — 结果不含持久的连接历史或订阅；缺失根 Fiber 一律报告为 `null`，无论没有存活根的原因是什么。
- **无来源与变更** — 服务不识别服务器由哪个 bundle、profile 或覆盖引入，也不能启用、停用、增删改 MCP 服务器。
