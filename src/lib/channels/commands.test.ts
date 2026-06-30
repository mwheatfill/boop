import { describe, expect, it } from 'vitest'
import { newId } from '@/lib/db/ids'
import { alertRules, workspaces } from '@/lib/db/schema'
import { createTestDb } from '@/lib/db/test-db'
import { FieldValidationError, NotFoundError } from '@/lib/errors'
import { archiveChannel, createChannel, restoreChannel, updateChannel } from './commands'

async function seedWorkspace(db: ReturnType<typeof createTestDb>) {
  const id = newId('cust')
  await db.insert(workspaces).values({ id, name: 'Acme', slug: 'acme', timezone: 'UTC' })
  return id
}

const teamsInput = {
  name: 'Ops Teams',
  slug: 'ops-teams',
  config: { kind: 'teams' as const, webhook_url: 'https://teams.example.com/hook' },
}

describe('createChannel', () => {
  it('inserts a channel with generated id + normalized slug', async () => {
    const db = createTestDb()
    await seedWorkspace(db)
    const channel = await createChannel(db, 'acme', teamsInput)
    expect(channel.id).toMatch(/^chn_/)
    expect(channel.slug).toBe('ops-teams')
    expect(channel.kind).toBe('teams')
  })

  it('rejects duplicate slug per Workspace', async () => {
    const db = createTestDb()
    await seedWorkspace(db)
    await createChannel(db, 'acme', teamsInput)
    await expect(
      createChannel(db, 'acme', { ...teamsInput, name: 'Other' }),
    ).rejects.toBeInstanceOf(FieldValidationError)
  })

  it('NotFound when workspace missing', async () => {
    const db = createTestDb()
    await expect(createChannel(db, 'missing', teamsInput)).rejects.toBeInstanceOf(NotFoundError)
  })
})

describe('updateChannel', () => {
  it('updates name + config', async () => {
    const db = createTestDb()
    await seedWorkspace(db)
    await createChannel(db, 'acme', teamsInput)
    const updated = await updateChannel(db, 'acme', 'ops-teams', {
      name: 'Ops Teams (renamed)',
      config: { kind: 'teams', webhook_url: 'https://teams.example.com/v2' },
    })
    expect(updated.name).toBe('Ops Teams (renamed)')
    expect(updated.config.kind).toBe('teams')
  })
})

describe('archiveChannel', () => {
  it('archives when no active rule references the channel', async () => {
    const db = createTestDb()
    await seedWorkspace(db)
    await createChannel(db, 'acme', teamsInput)
    const archived = await archiveChannel(db, 'acme', 'ops-teams')
    expect(archived.status).toBe('archived')
  })

  it('deletes the Channel even when an active rule references it', async () => {
    const db = createTestDb()
    const workspaceId = await seedWorkspace(db)
    const channel = await createChannel(db, 'acme', teamsInput)
    await db.insert(alertRules).values({
      id: newId('rul'),
      workspaceId,
      kind: 'first_failure',
      name: 'On first failure',
      slug: 'on-first-failure',
      config: '{}',
      channelIds: JSON.stringify([channel.id]),
    })
    const archived = await archiveChannel(db, 'acme', 'ops-teams')
    expect(archived.status).toBe('archived')
  })
})

describe('restoreChannel', () => {
  it('restores an archived channel round-trip', async () => {
    const db = createTestDb()
    await seedWorkspace(db)
    await createChannel(db, 'acme', teamsInput)
    await archiveChannel(db, 'acme', 'ops-teams')
    const restored = await restoreChannel(db, 'acme', 'ops-teams')
    expect(restored.status).toBe('active')
  })
})
