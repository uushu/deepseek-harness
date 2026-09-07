# Agent Note: Fork customizations use current capability owners

Status: implemented

English | [中文](2026-09-07-fork-customizations-current-capability-owners.zh.md)

## Problem

The web application retains local appearance controls, MCP and Skill settings, recoverable conversation deletion, and an account-balance display while it also uses the current session, workspace, LLM, and client-slot architecture.

These features need durable ownership that preserves session identity and current application composition without reviving retired client-runtime or API-proxy packages.

## Decision

Each retained customization uses the current capability that owns its data and lifecycle.

- `SessionController` owns recoverable deletion through `SessionTrash` under its configured `trashRoot`. Trash waits for an active Agent to stop, flushes an attached Session, detaches workspace membership, records recoverable metadata, and hides the session from ordinary list and search results. Restore reuses the same `SessionId`, reattaches each surviving recorded workspace, and removes the recovery record only after that work succeeds.
- `SessionPersistence.remove()` owns irreversible log removal. Purge and the thirty-day retention sweep call it only after an active writer has released the session; a failed removal keeps the recovery row for a later attempt. The JSONL recovery index validates its versioned records and replaces its file atomically.
- The workspace client exposes separate archive and deleted-conversation settings sections. Archive remains workspace visibility state, while the deleted-conversation section reads the recoverable index, provides a bounded history preview, restores a session, or requests its permanent purge.
- `LlmRuntime.remoteBalance()` owns the advisory balance route. It asks registered adapters in route order, and `DeepSeekAdapter.balance()` resolves the configured credential, applies a ten-second request limit, and returns no value when the provider cannot supply a balance. The chat statistics line displays a returned value without changing message delivery or chat failure handling.
- The Aqua appearance plugin and MCP and Skill settings packages mount through the current web bundle, remote registry, and `ui-settings` slots. Shared slot declarations remain owned by the base settings package so extension packages add pages without redefining the application contract.

## Alternatives considered

**Restore the retired client runtime and API proxy packages.** Rejected because their ownership overlaps current remotes, session persistence, and client slots, which would create two application paths for the same user state.

**Fetch the DeepSeek balance directly from the browser.** Rejected because the browser must not own configured credentials or provider-specific failure policy; the LLM adapter already owns both.

**Treat deletion as workspace archive only.** Rejected because archive intentionally keeps workspace accounting and only changes visibility, as recorded by [the archive decision](../feature/2026-07-31-session-archive-global-set.md); recoverable deletion needs its own retention and permanent-removal lifecycle.

**Drop the local customizations when taking upstream updates.** Rejected because the retained surfaces remain part of the application and can be expressed through the current owners without changing official core behavior.

## Consequences

The current web profile has one route for each feature: the session controller and persistence provider handle recoverable deletion, the LLM adapter handles provider balance, and client plugins contribute settings through declared slots.

Session logs remain intact until a user purges a trashed session or the retention sweep completes a successful persistent removal; temporary recovery-index failures preserve the row instead of hiding a failed deletion.

Focused controller, workspace, LLM, client-chat, UI-workspace, MCP, Skill, plugin-inventory, session-log-export, and icon tests cover the retained paths, and the corresponding host and client TypeScript projects type-check.
