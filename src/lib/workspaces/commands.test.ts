import { describe, expect, it } from 'vitest'
import { newId } from '@/lib/db/ids'
import { jobs, targets } from '@/lib/db/schema'
import { createTestDb } from '@/lib/db/test-db'
import { ArchiveBlockedError, FieldValidationError, NotFoundError } from '@/lib/errors'
import { archiveWorkspace, createWorkspace, restoreWorkspace, updateWorkspace } from './commands'

const validInput = {
  name: 'Acme',
  slug: 'acme',
  timezone: 'America/New_York',
}

describe('createWorkspace', () => {
  it('inserts a workspace with a generated id and normalized slug', async () => {
    const db = createTestDb()
    const workspace = await createWorkspace(db, validInput)
    expect(workspace.id).toMatch(/^cust_/)
    expect(workspace.name).toBe('Acme')
    expect(workspace.slug).toBe('acme')
    expect(workspace.status).toBe('active')
  })

  it('re-runs slugify on the submitted slug so whitespace cannot bypass canonicalization', async () => {
    const db = createTestDb()
    const workspace = await createWorkspace(db, { ...validInput, slug: 'Acme  Inc' })
    expect(workspace.slug).toBe('acme-inc')
  })

  it('rejects a slug that normalizes to empty', async () => {
    const db = createTestDb()
    await expect(createWorkspace(db, { ...validInput, slug: '...' })).rejects.toBeInstanceOf(
      FieldValidationError,
    )
  })

  it('rejects duplicate slugs as a Zod-shaped field error on slug', async () => {
    const db = createTestDb()
    await createWorkspace(db, validInput)
    let thrown: unknown
    try {
      await createWorkspace(db, { ...validInput, name: 'Acme Two' })
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
    const workspace = await createWorkspace(db, { ...validInput, autotaskCompanyId: '12345' })
    expect(workspace.autotaskCompanyId).toBe('12345')
  })
})

describe('updateWorkspace', () => {
  it('updates name, timezone, and autotask company id', async () => {
    const db = createTestDb()
    await createWorkspace(db, validInput)
    const updated = await updateWorkspace(db, 'acme', {
      name: 'Acme Updated',
      timezone: 'America/Chicago',
      autotaskCompanyId: '99',
    })
    expect(updated.name).toBe('Acme Updated')
    expect(updated.timezone).toBe('America/Chicago')
    expect(updated.autotaskCompanyId).toBe('99')
  })

  it('throws NotFoundError when no workspace matches the slug', async () => {
    const db = createTestDb()
    await expect(
      updateWorkspace(db, 'missing', { name: 'X', timezone: 'UTC' }),
    ).rejects.toBeInstanceOf(NotFoundError)
  })
})

describe('archiveWorkspace', () => {
  it('archives a workspace with no jobs', async () => {
    const db = createTestDb()
    await createWorkspace(db, validInput)
    const archived = await archiveWorkspace(db, 'acme')
    expect(archived.status).toBe('archived')
  })

  it('blocks when an active job exists, surfacing the blocking count', async () => {
    const db = createTestDb()
    const workspace = await createWorkspace(db, validInput)
    const targetId = newId('tgt')
    await db.insert(targets).values({
      id: targetId,
      workspaceId: workspace.id,
      name: 'API',
      slug: 'api',
      url: 'https://example.com',
      method: 'POST',
    })
    await db.insert(jobs).values({
      id: newId('job'),
      workspaceId: workspace.id,
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
      await archiveWorkspace(db, 'acme')
    } catch (err) {
      thrown = err
    }
    expect(thrown).toBeInstanceOf(ArchiveBlockedError)
    expect((thrown as ArchiveBlockedError).blockingCount).toBe(1)
  })
})

describe('restoreWorkspace', () => {
  it('restores an archived workspace round-trip', async () => {
    const db = createTestDb()
    await createWorkspace(db, validInput)
    const archived = await archiveWorkspace(db, 'acme')
    expect(archived.status).toBe('archived')
    const restored = await restoreWorkspace(db, 'acme')
    expect(restored.status).toBe('active')
  })
})
