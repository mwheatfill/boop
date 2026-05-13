import { describe, expect, it } from 'vitest'
import type { Database } from '@/lib/db/client'
import { newId } from '@/lib/db/ids'
import { channels, customers } from '@/lib/db/schema'
import { createTestDb } from '@/lib/db/test-db'
import { validateChannelScope } from './scope-refinement'

async function seedCustomer(db: Database, slug: string): Promise<string> {
  const id = newId('cust')
  await db.insert(customers).values({ id, name: slug, slug, timezone: 'UTC' })
  return id
}

async function seedCustomerChannel(
  db: Database,
  customerId: string,
  slug: string,
): Promise<string> {
  const id = newId('chn')
  await db.insert(channels).values({
    id,
    scope: 'customer',
    customerId,
    kind: 'webhook',
    name: slug,
    slug,
    config: '{}',
  })
  return id
}

async function seedWorkspaceChannel(db: Database, slug: string): Promise<string> {
  const id = newId('chn')
  await db.insert(channels).values({
    id,
    scope: 'workspace',
    customerId: null,
    kind: 'webhook',
    name: slug,
    slug,
    config: '{}',
  })
  return id
}

describe('validateChannelScope', () => {
  it('accepts an empty channel id list', async () => {
    const db = createTestDb()
    const r = await validateChannelScope(db, {
      scope: 'workspace',
      customerId: null,
      channelIds: [],
    })
    expect(r).toEqual({ ok: true })
  })

  it('workspace rule with workspace channels: ok', async () => {
    const db = createTestDb()
    const wsCh = await seedWorkspaceChannel(db, 'ws-1')
    const r = await validateChannelScope(db, {
      scope: 'workspace',
      customerId: null,
      channelIds: [wsCh],
    })
    expect(r).toEqual({ ok: true })
  })

  it('workspace rule with a customer channel: cross_scope_reference', async () => {
    const db = createTestDb()
    const acme = await seedCustomer(db, 'acme')
    const acmeCh = await seedCustomerChannel(db, acme, 'acme-ch')
    const r = await validateChannelScope(db, {
      scope: 'workspace',
      customerId: null,
      channelIds: [acmeCh],
    })
    expect(r).toMatchObject({ ok: false, reason: 'cross_scope_reference' })
  })

  it('Acme rule with Acme + workspace channels: ok', async () => {
    const db = createTestDb()
    const acme = await seedCustomer(db, 'acme')
    const acmeCh = await seedCustomerChannel(db, acme, 'acme-ch')
    const wsCh = await seedWorkspaceChannel(db, 'ws-1')
    const r = await validateChannelScope(db, {
      scope: 'customer',
      customerId: acme,
      channelIds: [acmeCh, wsCh],
    })
    expect(r).toEqual({ ok: true })
  })

  it('Acme rule with Beta channel: cross_scope_reference', async () => {
    const db = createTestDb()
    const acme = await seedCustomer(db, 'acme')
    const beta = await seedCustomer(db, 'beta')
    const betaCh = await seedCustomerChannel(db, beta, 'beta-ch')
    const r = await validateChannelScope(db, {
      scope: 'customer',
      customerId: acme,
      channelIds: [betaCh],
    })
    expect(r).toMatchObject({ ok: false, reason: 'cross_scope_reference' })
  })

  it('Job rule (inherits Customer scope) with Acme + workspace channels: ok', async () => {
    const db = createTestDb()
    const acme = await seedCustomer(db, 'acme')
    const acmeCh = await seedCustomerChannel(db, acme, 'acme-ch')
    const wsCh = await seedWorkspaceChannel(db, 'ws-1')
    const r = await validateChannelScope(db, {
      scope: 'job',
      customerId: acme,
      channelIds: [acmeCh, wsCh],
    })
    expect(r).toEqual({ ok: true })
  })

  it('Job rule with Beta channel: cross_scope_reference', async () => {
    const db = createTestDb()
    const acme = await seedCustomer(db, 'acme')
    const beta = await seedCustomer(db, 'beta')
    const betaCh = await seedCustomerChannel(db, beta, 'beta-ch')
    const r = await validateChannelScope(db, {
      scope: 'job',
      customerId: acme,
      channelIds: [betaCh],
    })
    expect(r).toMatchObject({ ok: false, reason: 'cross_scope_reference' })
  })
})
