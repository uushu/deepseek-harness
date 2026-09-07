# @deepseek-ai/dsh-host-mcp-inventory

English | [中文](README.zh.md)

Read-only Host projection of the MCP servers configured in this deployment. `McpInventoryGateway` registers the `mcpInventory` service and publishes one generated direct Remote, `mcpInventory/list`. Every call reads `ctx.loader.entries()` directly, skips structural group rows and non-MCP entries, and returns the configured `@deepseek-ai/dsh-mcp-client` instances in Loader order.

Each entry carries its Loader entry id, the resolved server config projected into a redacted view — server name, transport kind (`stdio`/`streamable-http`), command/args or endpoint URL, working directory, tool-call timeout, startup-failure policy, and reconnect policy — plus effective enablement and current root Fiber phase. Env and header map **values** are secrets and never leave the host: the projection exposes only their key names.

The phase is `pending`, `loading`, `active`, `failed`, or `unloading`; it is `null` when the entry has no live root Fiber. The snapshot is intentionally point-in-time: Loader remains the sole lifecycle authority, while this package owns no cache, history, provenance model, event stream, or mutation path. Its public payload types live under `./types`, and Typert generates the Host and Client Remote artifacts exposed by `./typert` and `./remote`.

The service is Remote-only and deliberately declares no same-process Cordis `Context` merge. Client packages consume it through the explicit [`api-remotes`](../../api/remotes/README.md) assembly rather than importing the Host implementation.

## Model Experience

None, as this Host-only inventory projection registers no prompt, tool, message, or provider request.

#### KV Cache effect

None; this package never assembles model input.

## Known Limitations and Deferred Work

- **Point-in-time state only** — the result contains no durable connection history or subscription; a missing root Fiber is reported as `null`, regardless of why no live root exists.
- **No provenance or mutation** — the service does not identify which bundle, profile, or override introduced a server, and it cannot enable, disable, add, edit, or remove MCP servers.
