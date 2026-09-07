/** Host loader entry for the browser implementation exported from `./client`. */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { settingsNamespace } from '@deepseek-ai/dsh-settings'

/** Durable settings namespace for product-wide GUI onboarding facts. */
const ONBOARDING_SETTINGS_NAMESPACE = 'ui-onboarding'

interface OnboardingSettings {
  /** Last version acknowledged by the current product welcome step. */
  welcomeNoticeVersion?: string
}

const OnboardingSettingsSchema: z<OnboardingSettings> = z.object({
  welcomeNoticeVersion: z.string(),
})

/** Durable settings namespace for the user's personalization instructions. */
const PERSONALIZATION_SETTINGS_NAMESPACE = 'personalization'

interface PersonalizationSettings {
  /** The user's personalization instruction list (GUI-editable in 设置 → 个性化). */
  instructions?: string[]
}

const PersonalizationSettingsSchema: z<PersonalizationSettings> = z.object({
  instructions: z.array(z.string()),
})

/** Register the durable GUI-onboarding and personalization sections when a settings provider exists. */
export function apply(ctx: Context): void {
  ctx.inject(['settings'], (settingsCtx) => {
    settingsCtx.settings.register(
      settingsNamespace(ONBOARDING_SETTINGS_NAMESPACE),
      OnboardingSettingsSchema,
    )
    settingsCtx.settings.register(
      settingsNamespace(PERSONALIZATION_SETTINGS_NAMESPACE),
      PersonalizationSettingsSchema,
    )
  })
}
