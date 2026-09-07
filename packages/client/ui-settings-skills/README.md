# @deepseek-ai/dsh-client-ui-settings-skills

English | [中文](README.zh.md)

Browser half of the **Skills** settings entry: one section in Web Settings that mirrors the Plugins section — a navigation row, an intro line, and two feature-owned tabs. The **Skill list** tab shows the current project's user-invocable skill catalog (name, description, optional guidance, and a model/user invocation badge) with an expandable provider/source detail; the **Skill configuration** tab groups the same catalog by provider and source so a user can see where each skill comes from (project root, user root, bundled, custom, …) and who may invoke it.

Both tabs read the session-addressed `skill.list` RPC through the shared connection client: the current session's project cwd resolves the catalog host-side, and when no session is open the surface reports that explicitly instead of inventing a project. The section declares the `settings.skills.tab` root list slot; the two tabs are registered into it by this same package, so the shell (ui-settings-general) and the settings domain base stay untouched. The surface is read-only by design: skill discovery roots live in the deployment and the agent presets, so editing them is a separate, write-path milestone.

## Model Experience

None, as this browser-only settings surface registers no prompt, tool, message, or provider request.

#### KV Cache effect

None; this package never assembles model input.

## Known Limitations and Deferred Work

- **Read-only** — the section lists the resolved project catalog; installing, removing, or editing skills is deferred.
- **Current-session scope** — the catalog is addressed to the current session's project; there is no cross-project or provider-level management view yet.
