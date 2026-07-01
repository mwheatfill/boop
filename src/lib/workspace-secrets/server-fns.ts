import { env } from 'cloudflare:workers'
import { createServerFn } from '@tanstack/react-start'
import { adminMiddleware } from '@/lib/auth/admin-middleware'
import { authMiddleware } from '@/lib/auth/auth-middleware'
import { createDb } from '@/lib/db/client'
import { NotFoundError } from '@/lib/errors'
import { resolveWorkspaceId } from '@/lib/workspaces/resolve'
import { WorkspaceSlugInput } from '@/shared/schemas/resource-refs'
import {
  SecretCreateInputSchema,
  SecretRotateInputSchema,
  WorkspaceSecretRef,
} from '@/shared/schemas/workspace-secret'
import {
  createSecret as createSecretCmd,
  DuplicateSecretNameError,
  listActiveSecrets as listActiveSecretsCmd,
  revokeSecret as revokeSecretCmd,
  rotateSecret as rotateSecretCmd,
  SecretNotFoundError,
} from './commands'

async function requireKek(): Promise<string> {
  const kek = await env.BOOP_SECRETS_KEK.get()
  if (!kek) {
    throw new Error('BOOP_SECRETS_KEK is not configured for this environment')
  }
  return kek
}

export const listWorkspaceSecretsFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator((data) => WorkspaceSlugInput.parse(data))
  .handler(async ({ data }) => {
    const db = createDb(env.DB)
    const workspaceId = await resolveWorkspaceId(db, data.workspaceSlug)
    return { secrets: await listActiveSecretsCmd({ db }, workspaceId) }
  })

export const createWorkspaceSecretFn = createServerFn({ method: 'POST' })
  .middleware([adminMiddleware])
  .inputValidator((data) => WorkspaceSlugInput.extend(SecretCreateInputSchema.shape).parse(data))
  .handler(async ({ data }) => {
    const db = createDb(env.DB)
    const workspaceId = await resolveWorkspaceId(db, data.workspaceSlug)
    try {
      return await createSecretCmd({ db, kek: await requireKek() }, workspaceId, {
        name: data.name,
        plaintext: data.plaintext,
      })
    } catch (err) {
      if (err instanceof DuplicateSecretNameError) {
        throw new Error(err.message)
      }
      throw err
    }
  })

export const rotateWorkspaceSecretFn = createServerFn({ method: 'POST' })
  .middleware([adminMiddleware])
  .inputValidator((data) => WorkspaceSecretRef.extend(SecretRotateInputSchema.shape).parse(data))
  .handler(async ({ data }) => {
    const db = createDb(env.DB)
    const workspaceId = await resolveWorkspaceId(db, data.workspaceSlug)
    try {
      return await rotateSecretCmd({ db, kek: await requireKek() }, workspaceId, data.name, {
        plaintext: data.plaintext,
      })
    } catch (err) {
      if (err instanceof SecretNotFoundError) {
        throw new NotFoundError('WorkspaceSecret', `${data.workspaceSlug}/${data.name}`)
      }
      throw err
    }
  })

export const revokeWorkspaceSecretFn = createServerFn({ method: 'POST' })
  .middleware([adminMiddleware])
  .inputValidator((data) => WorkspaceSecretRef.parse(data))
  .handler(async ({ data }) => {
    const db = createDb(env.DB)
    const workspaceId = await resolveWorkspaceId(db, data.workspaceSlug)
    return revokeSecretCmd({ db }, workspaceId, data.name)
  })
