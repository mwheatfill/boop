import { describe, expect, it } from 'vitest'
import { createCustomer } from '@/lib/customers/commands'
import { newId } from '@/lib/db/ids'
import { jobs } from '@/lib/db/schema'
import { createTestDb } from '@/lib/db/test-db'
import { ArchiveBlockedError, FieldValidationError, NotFoundError } from '@/lib/errors'
import { archiveTarget, createTarget, restoreTarget, updateTarget } from './commands'

const customerInput = { name: 'Acme', slug: 'acme', timezone: 'UTC' }

const targetInput = {
  name: 'Primary API',
  slug: 'primary-api',
  url: 'https://api.acme.com/healthz',
  method: 'POST' as const,
  authKind: 'none' as const,
  reachability: 'public' as const,
}

describe('createTarget', () => {
  it('inserts a target scoped to the customer', async () => {
    const db = createTestDb()
    await createCustomer(db, customerInput)
    const target = await createTarget(db, 'acme', targetInput)
    expect(target.id).toMatch(/^tgt_/)
    expect(target.customerId).toMatch(/^cust_/)
    expect(target.slug).toBe('primary-api')
    expect(target.status).toBe('active')
  })

  it('throws NotFoundError when the customer slug does not exist', async () => {
    const db = createTestDb()
    await expect(createTarget(db, 'missing', targetInput)).rejects.toBeInstanceOf(NotFoundError)
  })

  it('rejects duplicate slugs within the same customer', async () => {
    const db = createTestDb()
    await createCustomer(db, customerInput)
    await createTarget(db, 'acme', targetInput)
    let thrown: unknown
    try {
      await createTarget(db, 'acme', { ...targetInput, name: 'Primary API Two' })
    } catch (err) {
      thrown = err
    }
    expect(thrown).toBeInstanceOf(FieldValidationError)
    expect((thrown as FieldValidationError).fieldErrors).toHaveProperty('slug')
  })

  it('permits the same slug under a different customer', async () => {
    const db = createTestDb()
    await createCustomer(db, customerInput)
    await createCustomer(db, { ...customerInput, name: 'Beta', slug: 'beta' })
    await createTarget(db, 'acme', targetInput)
    const second = await createTarget(db, 'beta', targetInput)
    expect(second.slug).toBe('primary-api')
  })
})

describe('updateTarget', () => {
  it('updates url, method, auth, and reachability fields', async () => {
    const db = createTestDb()
    await createCustomer(db, customerInput)
    await createTarget(db, 'acme', targetInput)
    const updated = await updateTarget(db, 'acme', 'primary-api', {
      name: 'Renamed API',
      url: 'https://api.acme.com/v2/healthz',
      method: 'GET',
      authKind: 'bearer',
      authConfig: 'token-stub',
      reachability: 'tunnel',
    })
    expect(updated.name).toBe('Renamed API')
    expect(updated.url).toBe('https://api.acme.com/v2/healthz')
    expect(updated.method).toBe('GET')
    expect(updated.authKind).toBe('bearer')
    expect(updated.authConfig).toBe('token-stub')
    expect(updated.reachability).toBe('tunnel')
  })

  it('throws NotFoundError when the target slug does not exist for the customer', async () => {
    const db = createTestDb()
    await createCustomer(db, customerInput)
    await expect(
      updateTarget(db, 'acme', 'missing', {
        name: 'X',
        url: 'https://example.com',
        method: 'POST',
        authKind: 'none',
        reachability: 'public',
      }),
    ).rejects.toBeInstanceOf(NotFoundError)
  })
})

describe('archiveTarget', () => {
  it('archives a target with no jobs referencing it', async () => {
    const db = createTestDb()
    await createCustomer(db, customerInput)
    await createTarget(db, 'acme', targetInput)
    const archived = await archiveTarget(db, 'acme', 'primary-api')
    expect(archived.status).toBe('archived')
  })

  it('blocks when an active job references the target, with the blocking count', async () => {
    const db = createTestDb()
    const customer = await createCustomer(db, customerInput)
    const target = await createTarget(db, 'acme', targetInput)
    await db.insert(jobs).values({
      id: newId('job'),
      customerId: customer.id,
      targetId: target.id,
      name: 'Daily',
      slug: 'daily',
      triggerKind: 'cron',
      cronExpression: '* * * * *',
      triggerTimezone: 'UTC',
      status: 'active',
    })
    let thrown: unknown
    try {
      await archiveTarget(db, 'acme', 'primary-api')
    } catch (err) {
      thrown = err
    }
    expect(thrown).toBeInstanceOf(ArchiveBlockedError)
    expect((thrown as ArchiveBlockedError).blockingCount).toBe(1)
  })
})

describe('restoreTarget', () => {
  it('restores an archived target', async () => {
    const db = createTestDb()
    await createCustomer(db, customerInput)
    await createTarget(db, 'acme', targetInput)
    await archiveTarget(db, 'acme', 'primary-api')
    const restored = await restoreTarget(db, 'acme', 'primary-api')
    expect(restored.status).toBe('active')
  })
})
