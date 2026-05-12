import { z } from './openapi'

export const WebhookSecretSummarySchema = z
  .object({
    id: z.string(),
    createdAt: z.iso.datetime(),
    expiresAt: z.iso.datetime().nullable(),
    revokedAt: z.iso.datetime().nullable(),
  })
  .meta({ id: 'WebhookSecretSummary' })

export type WebhookSecretSummary = z.infer<typeof WebhookSecretSummarySchema>

export const WebhookSecretCreatedResponseSchema = z
  .object({
    id: z.string(),
    plaintext: z.string(),
    createdAt: z.iso.datetime(),
  })
  .meta({
    id: 'WebhookSecretCreatedResponse',
    description:
      'Returned exactly once from generate and rotate. The plaintext is the HMAC key the external caller must sign with. boop never returns it again.',
  })

export type WebhookSecretCreatedResponse = z.infer<typeof WebhookSecretCreatedResponseSchema>

export const RotateInputSchema = z
  .object({
    overlapHours: z.int().min(1).max(168).default(24),
  })
  .meta({ id: 'WebhookSecretRotateInput' })

export type RotateInput = z.infer<typeof RotateInputSchema>

export const WebhookSecretsStateSchema = z
  .object({
    secrets: z.array(WebhookSecretSummarySchema),
  })
  .meta({ id: 'WebhookSecretsState' })

export type WebhookSecretsState = z.infer<typeof WebhookSecretsStateSchema>
