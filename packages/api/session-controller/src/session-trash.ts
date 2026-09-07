/**
 * Session recoverable-delete metadata. A trashed conversation keeps its
 * immutable session log, while this separate index records when it was hidden
 * and which surviving workspace memberships restoration may reattach.
 * @module @deepseek-ai/dsh-api-session-controller/session-trash
 */

import type { SessionId } from '@deepseek-ai/dsh-session'
import type { WorkspaceId } from '@deepseek-ai/dsh-workspace/types'
import { TrashIndex, type TrashIndexEntry } from './trash-index.ts'

/** Thirty days of recovery before the retention sweep may permanently purge a conversation. */
export const SESSION_TRASH_RETENTION_MS = 30 * 24 * 60 * 60 * 1000

/** One recoverable Session deletion. */
export interface SessionTrashEntry extends TrashIndexEntry {
  /** Durable Session identity reused on restore. */
  readonly sessionId: SessionId
  /** Display-only blank-state snapshot from the deletion moment. */
  readonly blank: boolean
  /** Workspaces that accounted this session before deletion. */
  readonly workspaceIds: readonly WorkspaceId[]
  /** Durable title observed at deletion when one exists. */
  readonly title?: string
  /** Canonical project directory stored in the Session header. */
  readonly cwd?: string
  /** Durable fork parent when one exists. */
  readonly parentSessionId?: SessionId
  /** Coarse durable origin; subagents normally refuse this workflow. */
  readonly origin?: 'subagent'
  /** Agent composition stored with the Session. */
  readonly agentPreset?: string
}

function recordOf(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('entry is not an object')
  }
  return value as Record<string, unknown>
}

function requiredString(record: Record<string, unknown>, key: string): string {
  const value = record[key]
  if (typeof value !== 'string' || value.length === 0) throw new Error(`${key} is not a non-empty string`)
  return value
}

function optionalString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key]
  if (value === undefined) return undefined
  if (typeof value !== 'string') throw new Error(`${key} is not a string`)
  return value
}

function parseEntry(value: unknown): SessionTrashEntry {
  const record = recordOf(value)
  const sessionId = requiredString(record, 'sessionId') as SessionId
  const deletedAt = record.deletedAt
  if (typeof deletedAt !== 'number' || !Number.isSafeInteger(deletedAt) || deletedAt < 0) {
    throw new Error('deletedAt is not a non-negative safe integer')
  }
  const blank = record.blank
  if (typeof blank !== 'boolean') throw new Error('blank is not a boolean')
  const rawWorkspaceIds = record.workspaceIds
  if (!Array.isArray(rawWorkspaceIds) || rawWorkspaceIds.some(id => typeof id !== 'string' || id.length === 0)) {
    throw new Error('workspaceIds is not a string array')
  }
  const origin = record.origin
  if (origin !== undefined && origin !== 'subagent') throw new Error('origin is not supported')
  const parentSessionId = optionalString(record, 'parentSessionId') as SessionId | undefined
  const title = optionalString(record, 'title')
  const cwd = optionalString(record, 'cwd')
  const agentPreset = optionalString(record, 'agentPreset')
  return {
    sessionId,
    deletedAt,
    blank,
    workspaceIds: rawWorkspaceIds as WorkspaceId[],
    ...(title === undefined ? {} : { title }),
    ...(cwd === undefined ? {} : { cwd }),
    ...(parentSessionId === undefined ? {} : { parentSessionId }),
    ...(origin === undefined ? {} : { origin }),
    ...(agentPreset === undefined ? {} : { agentPreset }),
  }
}

/** Durable index for recoverable Session deletion. */
export class SessionTrash extends TrashIndex<SessionTrashEntry> {
  /** @param root - directory containing this deployment's session-trash index. */
  constructor(root: string) {
    super(root, SESSION_TRASH_RETENTION_MS, parseEntry)
  }

  /** Look up one trashed Session. */
  async get(sessionId: SessionId): Promise<SessionTrashEntry | undefined> {
    return (await this.list()).find(entry => entry.sessionId === sessionId)
  }

  /** Record one deletion, replacing an existing row for the same Session id. */
  add(entry: SessionTrashEntry): Promise<void> {
    return this.mutate(entries => [
      ...entries.filter(candidate => candidate.sessionId !== entry.sessionId),
      entry,
    ])
  }

  /** Remove one recovery row after a successful restore or permanent purge. */
  remove(sessionId: SessionId): Promise<void> {
    return this.mutate(entries => entries.filter(entry => entry.sessionId !== sessionId))
  }
}
