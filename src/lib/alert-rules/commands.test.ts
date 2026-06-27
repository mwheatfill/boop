import { describe, expect, it } from 'vitest'
import { createChannel } from '@/lib/channels/commands'
import { newId } from '@/lib/db/ids'
import { workspaces } from '@/lib/db/schema'
import { createTestDb } from '@/lib/db/test-db'
import { FieldValidationError } from '@/lib/errors'
import { archiveAlertRule, createAlertRule, restoreAlertRule, updateAlertRule } from './commands'

async function seedWorkspace(db: ReturnType<typeof createTestDb>) {
  const id = newId('cust')
  await db.insert(workspaces).values({ id, name: 'Acme', slug: 'acme', timezone: 'UTC' })
  return id
}

async function seedChannel(db: ReturnType<typeof createTestDb>, slug = 'ops-teams') {
  return createChannel(db, 'acme', {
    name: slug.replace('-', ' '),
    slug,
    config: { kind: 'teams', webhook_url: 'https://teams.example.com/hook' },
  })
}

describe('createAlertRule', () => {
  it('inserts a rule with validated channel ids', async () => {
    const db = createTestDb()
    await seedWorkspace(db)
    const channel = await seedChannel(db)
    const rule = await createAlertRule(db, 'acme', {
      name: 'On first failure',
      slug: 'on-first-failure',
      config: { kind: 'first_failure' },
      channelIds: [channel.id],
    })
    expect(rule.id).toMatch(/^rul_/)
    expect(rule.channelIds).toEqual([channel.id])
  })

  it('rejects when a channel id does not belong to the workspace', async () => {
    const db = createTestDb()
    await seedWorkspace(db)
    await expect(
      createAlertRule(db, 'acme', {
        name: 'On first failure',
        slug: 'on-first-failure',
        config: { kind: 'first_failure' },
        channelIds: ['chn_missing'],
      }),
    ).rejects.toBeInstanceOf(FieldValidationError)
  })

  it('rejects when the slug already exists', async () => {
    const db = createTestDb()
    await seedWorkspace(db)
    const channel = await seedChannel(db)
    await createAlertRule(db, 'acme', {
      name: 'Alert',
      slug: 'alert',
      config: { kind: 'first_failure' },
      channelIds: [channel.id],
    })
    await expect(
      createAlertRule(db, 'acme', {
        name: 'Other',
        slug: 'alert',
        config: { kind: 'recovery' },
        channelIds: [channel.id],
      }),
    ).rejects.toBeInstanceOf(FieldValidationError)
  })
})

describe('updateAlertRule', () => {
  it('updates kind, config, and channel set', async () => {
    const db = createTestDb()
    await seedWorkspace(db)
    const channel = await seedChannel(db)
    const otherChannel = await seedChannel(db, 'ops-email')
    await createAlertRule(db, 'acme', {
      name: 'Streak',
      slug: 'streak',
      config: { kind: 'consecutive_failures', count: 2 },
      channelIds: [channel.id],
    })
    const updated = await updateAlertRule(db, 'acme', 'streak', {
      name: 'Streak (deeper)',
      config: { kind: 'consecutive_failures', count: 5 },
      channelIds: [channel.id, otherChannel.id],
    })
    expect(updated.channelIds).toHaveLength(2)
    expect(updated.config).toMatchObject({ kind: 'consecutive_failures', count: 5 })
  })
})

describe('archiveAlertRule + restoreAlertRule', () => {
  it('archive + restore round-trips status', async () => {
    const db = createTestDb()
    await seedWorkspace(db)
    const channel = await seedChannel(db)
    await createAlertRule(db, 'acme', {
      name: 'R',
      slug: 'r',
      config: { kind: 'recovery' },
      channelIds: [channel.id],
    })
    const archived = await archiveAlertRule(db, 'acme', 'r')
    expect(archived.status).toBe('archived')
    const restored = await restoreAlertRule(db, 'acme', 'r')
    expect(restored.status).toBe('active')
  })
})
