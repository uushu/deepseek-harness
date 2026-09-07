# @deepseek-ai/dsh-client-ui-settings-mcp

English | [中文](README.zh.md)

Browser half of the **MCP** settings entry: one section in Web Settings that mirrors the Plugins section — a navigation row, an intro line, and two feature-owned tabs. The **MCP configuration** tab shows one expandable card per configured MCP server with its redacted resolved config (server name, transport kind, command/args or endpoint URL, env/header key names, timeouts, and reconnect policy); the **MCP list** tab is a searchable read-only inventory of the server instances with their Loader entry id, effective enablement, and root Fiber phase. Both tabs read the same `mcpInventory/list` Remote through [`api-remotes`](../../api/remotes/README.md) and never call it during plugin activation.

The section declares the `settings.mcp.tab` root list slot; the two tabs are registered into it by this same package, so the shell (ui-settings-general) and the settings domain base stay untouched. The surface is read-only by design: MCP server configuration lives in the deployment's `cordis.yml`, so editing is a separate, write-path milestone.

## Model Experience

None, as this browser-only settings surface registers no prompt, tool, message, or provider request.

#### KV Cache effect

None; this package never assembles model input.

## Known Limitations and Deferred Work

- **Read-only** — server cards show the resolved deployment config; adding, editing, or removing MCP servers is deferred.
- **Point-in-time status** — the list reflects the current Loader snapshot; connection-level detail beyond the Fiber phase (reconnecting, backoff attempts) is not yet exposed by the host gateway.
