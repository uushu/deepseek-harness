# Agent Note: Fork customizations use current capability owners

Status: implemented

[English](2026-09-07-fork-customizations-current-capability-owners.md) | 中文

## 问题

Web 应用保留本地外观控制、MCP 与 Skill 设置、可恢复的会话删除和账户余额展示，同时使用当前的会话、工作区、LLM 与客户端 slot 架构。

这些功能需要有持久化的归属，在不重启已退役的 client-runtime 或 API-proxy 包的前提下，保持会话身份与当前应用组合。

## 决策

每个被保留的定制功能都使用拥有其数据和生命周期的当前能力。

- `SessionController` 通过配置的 `trashRoot` 下的 `SessionTrash` 拥有可恢复删除。移入回收站会等待活动 Agent 停止、flush 已挂载的会话、解除工作区成员关系、记录可恢复元数据，并从普通列表和搜索结果中隐藏该会话。恢复会复用同一 `SessionId`、重新附加每个仍存在的已记录工作区，并且只在这些操作成功后删除恢复记录。
- `SessionPersistence.remove()` 拥有不可逆的日志移除。永久清理和三十天保留期 sweep 只会在活动 writer 已释放会话后调用它；移除失败会保留恢复记录，留待后续重试。JSONL 回收索引会校验带版本的记录，并以原子替换写入文件。
- 工作区客户端提供独立的归档与已删除会话设置区。归档保持为工作区可见性状态，而已删除会话区读取可恢复索引、提供有界历史预览、恢复会话或请求永久清理。
- `LlmRuntime.remoteBalance()` 拥有提示性余额路由。它按路由顺序询问已注册 adapter，`DeepSeekAdapter.balance()` 解析配置的凭据、施加十秒请求上限，并在提供方无法给出余额时返回无值。聊天统计行展示得到的余额，不改变消息传递或聊天失败处理。
- Aqua 外观插件以及 MCP 和 Skill 设置包通过当前 web bundle、远程注册表和 `ui-settings` slot 挂载。共享 slot 声明仍由基础设置包拥有，因此扩展包只添加页面，不会重复定义应用契约。

## 已考虑的替代方案

**恢复已退役的 client runtime 和 API proxy 包。** 否决：它们的归属会与当前 remotes、会话持久化和客户端 slots 重叠，为同一用户状态建立两条应用路径。

**在浏览器中直接获取 DeepSeek 余额。** 否决：浏览器不应拥有配置凭据或提供方特有的失败策略；LLM adapter 已同时拥有二者。

**仅把删除当作工作区归档。** 否决：如[归档决策](../feature/2026-07-31-session-archive-global-set.zh.md)所记载，归档有意保留工作区记账且只改变可见性；可恢复删除需要独立的保留期与永久移除生命周期。

**在接收上游更新时丢弃本地定制功能。** 否决：这些保留界面仍是应用的一部分，并且可以通过当前归属表达，而无需改变官方核心行为。

## 后果

当前 web profile 中每项功能只有一条路径：会话 controller 与持久化提供方处理可恢复删除，LLM adapter 处理提供方余额，客户端插件通过声明的 slots 贡献设置项。

在用户永久清理回收站会话之前，或保留期 sweep 成功完成持久化移除之前，会话日志保持完整；临时的恢复索引失败会保留记录，而不会把一次失败的删除隐藏起来。

聚焦的 controller、workspace、LLM、client-chat、UI-workspace、MCP、Skill、plugin-inventory、session-log-export 和图标测试覆盖保留路径，对应的 host 与 client TypeScript 项目也完成 type-check。
