/**
 * skills domain zod schemas (names derived from map keys: skillListRequestSchema /
 * skillListValueSchema).
 */

import { z } from 'zod'
import type { RequestPayload, ResponseValue } from './rpc-map.ts'
import type { Wire } from './rpc.schema.ts'
import { sessionIdSchema } from './sessions.schema.ts'
import type { SkillEntry, SkillWrite } from './skills.ts'

/** SkillEntry row of skill.list. */
export const skillEntrySchema = z.object({
  name: z.string().min(1),
  description: z.string(),
  whenToUse: z.string().optional(),
  modelInvocable: z.boolean(),
  provider: z.string(),
  source: z.string(),
}) satisfies z.ZodType<Wire<SkillEntry>>

/** skill.list request payload. */
export const skillListRequestSchema = z.object({
  sessionId: sessionIdSchema,
  // Settings surface: also return model-only skills (bundled/internal) so the
  // config/list tabs can expose them; the composer keeps the user-invocable view.
  includeInternal: z.boolean().default(false),
}) satisfies z.ZodType<Wire<RequestPayload<'skill.list'>>>

/** skill.list response value. */
export const skillListValueSchema = z.object({
  skills: z.array(skillEntrySchema),
}) satisfies z.ZodType<Wire<ResponseValue<'skill.list'>>>

/** One project skill file to create or replace. */
export const skillWriteSchema = z.object({
  name: z.string().min(1),
  description: z.string(),
  whenToUse: z.string().optional(),
  modelInvocable: z.boolean(),
  content: z.string(),
}) satisfies z.ZodType<Wire<SkillWrite>>

/** skill.write request payload. */
export const skillWriteRequestSchema = z.object({
  sessionId: sessionIdSchema,
  skill: skillWriteSchema,
}) satisfies z.ZodType<Wire<RequestPayload<'skill.write'>>>

/** skill.write response value. */
export const skillWriteValueSchema = z.object({
  name: z.string(),
}) satisfies z.ZodType<Wire<ResponseValue<'skill.write'>>>

/** skill.read request payload. */
export const skillReadRequestSchema = z.object({
  sessionId: sessionIdSchema,
  name: z.string(),
}) satisfies z.ZodType<Wire<RequestPayload<'skill.read'>>>

/** skill.read response value. */
export const skillReadValueSchema = z.object({
  content: z.string(),
}) satisfies z.ZodType<Wire<ResponseValue<'skill.read'>>>

/** skill.remove request payload. */
export const skillRemoveRequestSchema = z.object({
  sessionId: sessionIdSchema,
  name: z.string(),
}) satisfies z.ZodType<Wire<RequestPayload<'skill.remove'>>>

/** skill.remove response value. */
export const skillRemoveValueSchema = z.object({
  removed: z.boolean(),
}) satisfies z.ZodType<Wire<ResponseValue<'skill.remove'>>>
