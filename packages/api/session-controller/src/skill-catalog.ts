/** Session-addressed, cold-readable and project-writable Skill Remote. */

import { randomUUID } from 'node:crypto'
import { mkdir, rename, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-agent-presets/types'
import type { SessionId } from '@deepseek-ai/dsh-session'
import { SessionQueryError } from '@deepseek-ai/dsh-session-query'
import { isUserInvocable } from '@deepseek-ai/dsh-skill'
import type { ScopeKey } from '@deepseek-ai/dsh-scope'
import { Remote, RemoteError, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import { stringify as stringifyYaml } from 'yaml'
import type {
  SkillListRequest,
  SkillListValue,
  SkillWriteInput,
  SkillWriteRequest,
  SkillWriteValue,
} from './types.ts'

/** Valid project Skill names: lowercase kebab-case with no path separators. */
const SKILL_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** Validate one untrusted project Skill file request. */
function validateSkillWrite(input: unknown): string | undefined {
  if (typeof input !== 'object' || input === null) return 'skill must be an object'
  const skill = input as Record<string, unknown>
  const name = typeof skill.name === 'string' ? skill.name : ''
  if (!SKILL_NAME.test(name)) return `invalid skill name "${name}"`
  if (typeof skill.description !== 'string' || skill.description.length === 0) {
    return 'description is required'
  }
  if (typeof skill.content !== 'string') return 'content must be a string'
  if (skill.whenToUse !== undefined && typeof skill.whenToUse !== 'string') {
    return 'whenToUse must be a string'
  }
  if (typeof skill.modelInvocable !== 'boolean') return 'modelInvocable must be a boolean'
  return undefined
}

/** Project details recovered from one durable Session observation. */
interface SessionSkillContext {
  readonly cwd: string
  readonly agentPreset?: string
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Host owner of the Session-addressed `skills` Remote namespace. */
    sessionSkillCatalog: SessionSkillCatalog
  }
}

/** Host service backing `ctx.remote.skills` without activating a cold Agent. */
export class SessionSkillCatalog extends TypertRemoteService {
  static inject = ['agents', 'sessionQuery', 'typert']

  /** @param ctx - Host context carrying Session reads and optional skill/preset services. */
  constructor(ctx: Context) {
    super(ctx, 'sessionSkillCatalog', { namespace: 'skills' })
  }

  /**
   * List the Skills visible to one Session composition.
   * @param request - Session identity whose cwd and preset select the catalog view.
   * @param signal - caller lifetime carried by the Remote transport; admitted catalog reads retain their existing completion semantics.
   * @returns human-invocable Skill metadata, or the complete settings inventory when requested.
   * @throws RemoteError when the Session cannot be inspected or no registry can serve it.
   */
  @Remote
  async list(request: SkillListRequest, signal: AbortSignal): Promise<SkillListValue> {
    void signal
    const { sessionId } = request
    const { cwd, agentPreset } = await this.sessionContext(sessionId)

    const live = this.ctx.agents.get(sessionId)
    const presets = this.ctx.get('agentPresets')
    const scoped = live === undefined ? undefined : presets?.serviceFor(live, 'skills')
    const skillRegistry = scoped ?? this.ctx.get('skills')
    if (skillRegistry === undefined) {
      throw new RemoteError(
        'gateway/internal',
        'skill registry is absent: neither this session\'s agent preset nor the host composition mounts @deepseek-ai/dsh-skill',
        {},
      )
    }

    const scope = await this.scopeFor(sessionId, agentPreset)
    try {
      const skills = (await skillRegistry.list({ cwd, scope }))
        .filter(skill => request.includeInternal === true || isUserInvocable(skill))
      return {
        skills: skills.map(skill => ({
          name: skill.name,
          description: skill.description,
          ...skill.whenToUse === undefined ? {} : { whenToUse: skill.whenToUse },
          modelInvocable: skill.invocation.modelInvocable,
          provider: skill.provider,
          source: skill.source,
        })),
      }
    } catch (error: unknown) {
      throw new RemoteError('gateway/internal', `skill listing failed: ${String(error)}`, {})
    }
  }

  /**
   * Create or replace one project-owned Skill file under the Session's recorded cwd.
   * @param request - Session address and untrusted Skill frontmatter/body input.
   * @returns the accepted Skill name after its file atomically replaces the prior generation.
   * @throws RemoteError when validation, Session lookup, or the file operation fails.
   */
  @Remote
  async write(request: SkillWriteRequest): Promise<SkillWriteValue> {
    const input = request.skill as unknown
    const invalid = validateSkillWrite(input)
    if (invalid !== undefined) {
      throw new RemoteError('gateway/bad-request', `invalid project Skill: ${invalid}`, {})
    }
    const skill = input as SkillWriteInput
    const { cwd } = await this.sessionContext(request.sessionId)
    const directory = join(cwd, '.dsh', 'skills', skill.name)
    const file = join(directory, 'SKILL.md')
    const temporary = `${file}.${randomUUID()}.tmp`
    const frontmatter = {
      name: skill.name,
      description: skill.description,
      ...skill.whenToUse === undefined || skill.whenToUse.length === 0 ? {} : { whenToUse: skill.whenToUse },
      ...skill.modelInvocable ? {} : { 'disable-model-invocation': true },
    }
    const body = `---\n${stringifyYaml(frontmatter)}---\n${skill.content}`
    try {
      await mkdir(directory, { recursive: true, mode: 0o700 })
      try {
        await writeFile(temporary, body, { encoding: 'utf8', mode: 0o600 })
        await rename(temporary, file)
      } catch (error: unknown) {
        try {
          await rm(temporary, { force: true })
        } catch {
          // Cleanup can only remove the private temporary generation.
        }
        throw error
      }
      return { name: skill.name }
    } catch (error: unknown) {
      throw new RemoteError('gateway/internal', `skill write failed: ${String(error)}`, {})
    }
  }

  /** Resolve a Session's cwd and recorded preset without activating an Agent. */
  private async sessionContext(sessionId: SessionId): Promise<SessionSkillContext> {
    try {
      using observation = await this.ctx.sessionQuery.observeSession(sessionId)
      if (observation.projections === undefined) {
        throw new Error('skill catalog requires a projected Session observation')
      }
      const cwd = observation.header.cwd
      if (cwd === undefined) {
        throw new Error(`session "${sessionId}" has no project cwd`)
      }
      const agentPreset = observation.projections.values.agentPreset ?? undefined
      return {
        cwd,
        ...agentPreset === undefined ? {} : { agentPreset },
      }
    } catch (error: unknown) {
      if (error instanceof SessionQueryError
        && error.code === 'SESSION_QUERY_SESSION_NOT_FOUND') {
        throw new RemoteError('session/not-found', `session "${sessionId}" not found`, { sessionId })
      }
      throw new RemoteError(
        'gateway/internal',
        `session "${sessionId}" could not be inspected: ${String(error)}`,
        {},
      )
    }
  }

  /** Resolve a live or standing preset scope without creating an Agent. */
  private async scopeFor(
    sessionId: SessionId,
    agentPreset: string | undefined,
  ): Promise<ScopeKey | undefined> {
    const live = this.ctx.agents.get(sessionId)
    if (live !== undefined) return live
    const presets = this.ctx.get('agentPresets')
    if (presets === undefined) return undefined
    try {
      return await presets.standingKeyFor(agentPreset)
    } catch {
      // An unknown or unusable recorded preset falls back to the global registry.
      return undefined
    }
  }
}

export default SessionSkillCatalog
