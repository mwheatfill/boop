import { env } from 'cloudflare:workers'
import { createServerFn } from '@tanstack/react-start'
import { eq } from 'drizzle-orm'
import { adminMiddleware } from '@/lib/auth/admin-middleware'
import { authMiddleware } from '@/lib/auth/auth-middleware'
import { createDb } from '@/lib/db/client'
import { customers } from '@/lib/db/schema'
import { NotFoundError } from '@/lib/errors'
import { SecretCreateInputSchema, SecretRotateInputSchema } from '@/shared/schemas/customer-secret'
import { z } from '@/shared/schemas/openapi'
import {
  createSecret as createSecretCmd,
  DuplicateSecretNameError,
  listActiveSecrets as listActiveSecretsCmd,
  revokeSecret as revokeSecretCmd,
  rotateSecret as rotateSecretCmd,
  SecretNotFoundError,
} from './commands'

const customerSlugInput = z.object({ customerSlug: z.string().min(1) })

async function resolveCustomerId(
  db: ReturnType<typeof createDb>,
  customerSlug: string,
): Promise<string> {
  const [row] = await db
    .select({ id: customers.id })
    .from(customers)
    .where(eq(customers.slug, customerSlug))
    .limit(1)
  if (!row) throw new NotFoundError('Customer', customerSlug)
  return row.id
}

function requireKek(): string {
  const kek = (env as { BOOP_SECRETS_KEK?: string }).BOOP_SECRETS_KEK
  if (!kek) {
    throw new Error('BOOP_SECRETS_KEK is not configured for this environment')
  }
  return kek
}

export const listCustomerSecretsFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator((data) => customerSlugInput.parse(data))
  .handler(async ({ data }) => {
    const db = createDb(env.DB)
    const customerId = await resolveCustomerId(db, data.customerSlug)
    return { secrets: await listActiveSecretsCmd({ db, kek: '' }, customerId) }
  })

export const createCustomerSecretFn = createServerFn({ method: 'POST' })
  .middleware([adminMiddleware])
  .inputValidator((data) => customerSlugInput.extend(SecretCreateInputSchema.shape).parse(data))
  .handler(async ({ data }) => {
    const db = createDb(env.DB)
    const customerId = await resolveCustomerId(db, data.customerSlug)
    try {
      return await createSecretCmd({ db, kek: requireKek() }, customerId, {
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

export const rotateCustomerSecretFn = createServerFn({ method: 'POST' })
  .middleware([adminMiddleware])
  .inputValidator((data) =>
    customerSlugInput
      .extend({ name: z.string() })
      .extend(SecretRotateInputSchema.shape)
      .parse(data),
  )
  .handler(async ({ data }) => {
    const db = createDb(env.DB)
    const customerId = await resolveCustomerId(db, data.customerSlug)
    try {
      return await rotateSecretCmd({ db, kek: requireKek() }, customerId, data.name, {
        plaintext: data.plaintext,
      })
    } catch (err) {
      if (err instanceof SecretNotFoundError) {
        throw new NotFoundError('CustomerSecret', `${data.customerSlug}/${data.name}`)
      }
      throw err
    }
  })

export const revokeCustomerSecretFn = createServerFn({ method: 'POST' })
  .middleware([adminMiddleware])
  .inputValidator((data) => customerSlugInput.extend({ name: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const db = createDb(env.DB)
    const customerId = await resolveCustomerId(db, data.customerSlug)
    return revokeSecretCmd({ db, kek: '' }, customerId, data.name)
  })
