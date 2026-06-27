import { LIQUID_IDENTIFIER_MESSAGE, LIQUID_IDENTIFIER_PATTERN } from './fields'
import { z } from './openapi'

const MAX_SECRET_VALUE_LEN = 4096

export const SecretNameSchema = z
  .string()
  .regex(LIQUID_IDENTIFIER_PATTERN, LIQUID_IDENTIFIER_MESSAGE)
  .meta({ id: 'WorkspaceSecretName', example: 'stripe_api_key' })

export const SecretPlaintextSchema = z
  .string()
  .min(1, 'Secret value is required')
  .max(MAX_SECRET_VALUE_LEN, `Secret value must be ${MAX_SECRET_VALUE_LEN} characters or fewer`)

export const SecretCreateInputSchema = z
  .object({
    name: SecretNameSchema,
    plaintext: SecretPlaintextSchema,
  })
  .meta({ id: 'WorkspaceSecretCreateInput' })

export type SecretCreateInput = z.infer<typeof SecretCreateInputSchema>

export const SecretRotateInputSchema = z
  .object({
    plaintext: SecretPlaintextSchema,
  })
  .meta({ id: 'WorkspaceSecretRotateInput' })

export type SecretRotateInput = z.infer<typeof SecretRotateInputSchema>

export const SecretSummarySchema = z
  .object({
    id: z.string(),
    name: SecretNameSchema,
    createdAt: z.iso.datetime(),
    lastUsedAt: z.iso.datetime().nullable(),
    revokedAt: z.iso.datetime().nullable(),
  })
  .meta({
    id: 'WorkspaceSecretSummary',
    description:
      'Metadata for a Workspace-scoped secret. The plaintext is returned exactly once from create + rotate; subsequent fetches return only this summary.',
  })

export type SecretSummary = z.infer<typeof SecretSummarySchema>

export const SecretRevealedResponseSchema = z
  .object({
    id: z.string(),
    name: SecretNameSchema,
    plaintext: z.string(),
    createdAt: z.iso.datetime(),
  })
  .meta({
    id: 'WorkspaceSecretRevealedResponse',
    description:
      'Returned exactly once from create and rotate. boop never returns the plaintext again.',
  })

export type SecretRevealedResponse = z.infer<typeof SecretRevealedResponseSchema>
