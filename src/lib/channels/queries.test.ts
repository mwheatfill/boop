import { describe, expect, it } from 'vitest'
import { newId } from '@/lib/db/ids'
import { channels, workspaces } from '@/lib/db/schema'
import { createTestDb } from '@/lib/db/test-db'
import { createChannel } from './commands'
import { listChannelsForWorkspace } from './queries'

describe('listChannelsForWorkspace', () => {
  it('skips a row with an unparseable config instead of failing the whole list', async () => {
    const db = createTestDb()
    const workspaceId = newId('cust')
    await db
      .insert(workspaces)
      .values({ id: workspaceId, name: 'Acme', slug: 'acme', timezone: 'UTC' })
    await createChannel(db, 'acme', {
      name: 'Ops Teams',
      slug: 'ops-teams',
      config: { kind: 'teams', webhook_url: 'https://teams.example.com/hook' },
    })
    // Valid kind, but the config JSON is missing the webhook's required url:
    // toChannel would throw, which previously blanked the whole list.
    await db.insert(channels).values({
      id: newId('chn'),
      workspaceId,
      kind: 'webhook',
      name: 'Broken',
      slug: 'broken',
      config: '{}',
    })

    const list = await listChannelsForWorkspace(db, 'acme')
    expect(list.map((channel) => channel.slug)).toEqual(['ops-teams'])
  })
})
