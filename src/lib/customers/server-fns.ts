import { env } from 'cloudflare:workers'
import { createServerFn } from '@tanstack/react-start'
import { adminMiddleware } from '@/lib/auth/admin-middleware'
import { authMiddleware } from '@/lib/auth/auth-middleware'
import { createDb } from '@/lib/db/client'
import { asMutationFailure, type MutationResult } from '@/lib/mutation-result'
import type { Customer } from '@/shared/schemas/customer'
import { CustomerCreateInput, CustomerUpdateInput } from '@/shared/schemas/customer'
import { z } from '@/shared/schemas/openapi'
import { archiveCustomer, createCustomer, restoreCustomer, updateCustomer } from './commands'
import { countCustomers, getCustomerBySlug, getOrgTimezone, listCustomers } from './queries'

export const listCustomersFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator((data: { includeArchived?: boolean } | undefined) =>
    z.object({ includeArchived: z.boolean().optional() }).parse(data ?? {}),
  )
  .handler(async ({ data }) =>
    listCustomers(createDb(env.DB), data.includeArchived ? { includeArchived: true } : {}),
  )

export const countCustomersFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async () => countCustomers(createDb(env.DB)))

export const getOrgTimezoneFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(
    async (): Promise<{ timezone: string }> => ({
      timezone: await getOrgTimezone(createDb(env.DB)),
    }),
  )

export const getCustomerFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator((data: { slug: string }) => z.object({ slug: z.string().min(1) }).parse(data))
  .handler(async ({ data }) => getCustomerBySlug(createDb(env.DB), data.slug))

export const createCustomerFn = createServerFn({ method: 'POST' })
  .middleware([adminMiddleware])
  .inputValidator((data) => CustomerCreateInput.parse(data))
  .handler(async ({ data }): Promise<MutationResult<Customer>> => {
    try {
      const customer = await createCustomer(createDb(env.DB), data)
      return { ok: true, data: customer }
    } catch (err) {
      const failure = asMutationFailure(err)
      if (failure) return failure
      throw err
    }
  })

export const updateCustomerFn = createServerFn({ method: 'POST' })
  .middleware([adminMiddleware])
  .inputValidator((data: { slug: string } & z.infer<typeof CustomerUpdateInput>) =>
    z
      .object({ slug: z.string().min(1) })
      .extend(CustomerUpdateInput.shape)
      .parse(data),
  )
  .handler(async ({ data }): Promise<MutationResult<Customer>> => {
    const { slug, ...input } = data
    try {
      const customer = await updateCustomer(createDb(env.DB), slug, input)
      return { ok: true, data: customer }
    } catch (err) {
      const failure = asMutationFailure(err)
      if (failure) return failure
      throw err
    }
  })

export const archiveCustomerFn = createServerFn({ method: 'POST' })
  .middleware([adminMiddleware])
  .inputValidator((data: { slug: string }) => z.object({ slug: z.string().min(1) }).parse(data))
  .handler(async ({ data }): Promise<MutationResult<Customer>> => {
    try {
      const customer = await archiveCustomer(createDb(env.DB), data.slug)
      return { ok: true, data: customer }
    } catch (err) {
      const failure = asMutationFailure(err)
      if (failure) return failure
      throw err
    }
  })

export const restoreCustomerFn = createServerFn({ method: 'POST' })
  .middleware([adminMiddleware])
  .inputValidator((data: { slug: string }) => z.object({ slug: z.string().min(1) }).parse(data))
  .handler(async ({ data }) => ({
    ok: true as const,
    data: await restoreCustomer(createDb(env.DB), data.slug),
  }))
