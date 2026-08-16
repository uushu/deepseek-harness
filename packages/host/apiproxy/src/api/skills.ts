/**
 * skills domain contract: catalog lookup and project skill-file management,
 * both addressed by session. The session's header cwd resolves to the
 * canonical project root host-side — the client never submits a raw path.
 * Writes land in the project's `.dsh/skills` directory, where the filesystem
 * provider's watcher picks them up without any reload.
 */

import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { RpcRequest, RpcResponse } from './rpc.ts'

/** Skill catalog row (wire projection of the host SkillSummary; provider/source vocabulary stays host-side). */
export interface SkillEntry {
  /** Kebab-case identifier the user references as `/name` in the composer. */
  readonly name: string
  /** Short routing description. */
  readonly description: string
  /** Optional extra routing guidance. */
  readonly whenToUse?: string
  /** False marks a user-only skill (`disable-model-invocation`): invocable here, absent from the model catalog. */
  readonly modelInvocable: boolean
  /** Provider that owns this skill body (e.g. `filesystem`). */
  readonly provider: string
  /** Discovery source that produced this winning skill (e.g. `project-dsh`, `user-agents`, `bundled`). */
  readonly source: string
}

/** One project skill file to create or replace. */
export interface SkillWrite {
  /** Kebab-case skill name; also the directory name under `.dsh/skills`. */
  readonly name: string
  /** Short routing description (frontmatter `description`). */
  readonly description: string
  /** Optional extra routing guidance (frontmatter `whenToUse`). */
  readonly whenToUse?: string
  /** False writes `disable-model-invocation: true`; true omits it. */
  readonly modelInvocable: boolean
  /** Markdown instruction body after the frontmatter. */
  readonly content: string
}

/** Result of reading one project skill file's markdown body. */
export interface SkillReadResult {
  /** The markdown instruction body after the frontmatter. */
  readonly content: string
}

/** Result of removing one project skill file. */
export interface SkillRemoveResult {
  /** Whether a skill file existed at the expected location. */
  readonly removed: boolean
}

/**
 * Skill-domain unary methods (the map key skill.* of RpcMethodMap).
 * Invocation itself is a plain `session.prompt` whose leading `/name` token
 * the host recognizes at the pre-step boundary (`dsh-tool-skill` injects the
 * rendered body there), so every client shares one deterministic path with no
 * dedicated invocation wire.
 */
export interface SkillsApi {
  /** Lists the user-invocable skill catalog for the session's project. */
  list(request: RpcRequest<{ sessionId: SessionId }>): Promise<RpcResponse<{ skills: readonly SkillEntry[] }>>
  /** Create or replace one project skill file under `.dsh/skills`. */
  write(request: RpcRequest<{ sessionId: SessionId; skill: SkillWrite }>): Promise<RpcResponse<{ name: string }>>
  /** Read one project skill file's markdown body. */
  read(request: RpcRequest<{ sessionId: SessionId; name: string }>): Promise<RpcResponse<SkillReadResult>>
  /** Remove one project skill file from `.dsh/skills`. */
  remove(request: RpcRequest<{ sessionId: SessionId; name: string }>): Promise<RpcResponse<SkillRemoveResult>>
}
