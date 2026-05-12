import { describe, expect, it } from 'vitest'
import { newId } from '@/lib/db/ids'
import { jobs, targets } from '@/lib/db/schema'
import { createTestDb } from '@/lib/db/test-db'
import { ArchiveBlockedError, FieldValidationError, NotFoundError } from '@/lib/errors'
import { archiveCustomer, createCustomer, restoreCustomer, updateCustomer } from './commands'

const validInput = {
  name: 'Acme',
  slug: 'acme',
  timezone: 'America/New_York',
}

describe('createCustomer', () => {
  it('inserts a customer with a generated id and normalized slug', async () => {
    const db = createTestDb()
    const customer = await createCustomer(db, validInput)
    expect(customer.id).toMatch(/^cust_/)
    expect(customer.name).toBe('Acme')
    expect(customer.slug).toBe('acme')
    expect(customer.status).toBe('active')
  })

  it('re-runs slugify on the submitted slug so whitespace cannot bypass canonicalization', async () => {
    const db = createTestDb()
    const customer = await createCustomer(db, { ...validInput, slug: 'Acme  Inc' })
    expect(customer.slug).toBe('acme-inc')
  })

  it('rejects a slug that normalizes to empty', async () => {
    const db = createTestDb()
    await expect(createCustomer(db, { ...validInput, slug: '...' })).rejects.toBeInstanceOf(
      FieldValidationError,
    )
  })

  it('rejects duplicate slugs as a Zod-shaped field error on slug', async () => {
    const db = createTestDb()
    await createCustomer(db, validInput)
    let thrown: unknown
    try {
      await createCustomer(db, { ...validInput, name: 'Acme Two' })
    } catch (err) {
      thrown = err
    }
    expect(thrown).toBeInstanceOf(FieldValidationError)
    expect((thrown as FieldValidationError).fieldErrors).toMatchObject({
      slug: expect.arrayContaining([expect.stringContaining('already in use')]),
    })
  })

  it('persists an autotask company id when provided', async () => {
    const db = createTestDb()
    const customer = await createCustomer(db, { ...validInput, autotaskCompanyId: '12345' })
    expect(customer.autotaskCompanyId).toBe('12345')
  })
})

describe('updateCustomer', () => {
  it('updates name, timezone, and autotask company id', async () => {
    const db = createTestDb()
    await createCustomer(db, validInput)
    const updated = await updateCustomer(db, 'acme', {
      name: 'Acme Updated',
      timezone: 'America/Chicago',
      autotaskCompanyId: '99',
    })
    expect(updated.name).toBe('Acme Updated')
    expect(updated.timezone).toBe('America/Chicago')
    expect(updated.autotaskCompanyId).toBe('99')
  })

  it('throws NotFoundError when no customer matches the slug', async () => {
    const db = createTestDb()
    await expect(
      updateCustomer(db, 'missing', { name: 'X', timezone: 'UTC' }),
    ).rejects.toBeInstanceOf(NotFoundError)
  })
})

describe('archiveCustomer', () => {
  it('archives a customer with no jobs', async () => {
    const db = createTestDb()
    await createCustomer(db, validInput)
    const archived = await archiveCustomer(db, 'acme')
    expect(archived.status).toBe('archived')
  })

  it('blocks when an active job exists, surfacing the blocking count', async () => {
    const db = createTestDb()
    const customer = await createCustomer(db, validInput)
    const targetId = newId('tgt')
    await db.insert(targets).values({
      id: targetId,
      customerId: customer.id,
      name: 'API',
      slug: 'api',
      url: 'https://example.com',
      method: 'POST',
    })
    await db.insert(jobs).values({
      id: newId('job'),
      customerId: customer.id,
      targetId,
      name: 'Daily',
      slug: 'daily',
      triggerKind: 'cron',
      cronExpression: '* * * * *',
      triggerTimezone: 'UTC',
      status: 'active',
    })
    let thrown: unknown
    try {
      await archiveCustomer(db, 'acme')
    } catch (err) {
      thrown = err
    }
    expect(thrown).toBeInstanceOf(ArchiveBlockedError)
    expect((thrown as ArchiveBlockedError).blockingCount).toBe(1)
  })
})

describe('restoreCustomer', () => {
  it('restores an archived customer round-trip', async () => {
    const db = createTestDb()
    await createCustomer(db, validInput)
    const archived = await archiveCustomer(db, 'acme')
    expect(archived.status).toBe('archived')
    const restored = await restoreCustomer(db, 'acme')
    expect(restored.status).toBe('active')
  })
})
