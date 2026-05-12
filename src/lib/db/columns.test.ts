import { getTableConfig, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { describe, expect, it } from 'vitest'
import { lifecycleCheck, timestamps } from './columns'

describe('timestamps()', () => {
  const tbl = sqliteTable('demo', { id: text('id').primaryKey(), ...timestamps() })

  it('adds created_at and updated_at columns', () => {
    const names = getTableConfig(tbl).columns.map((c) => c.name)
    expect(names).toContain('created_at')
    expect(names).toContain('updated_at')
  })

  it('uses timestamp_ms mode (returns Date objects)', () => {
    const createdAt = getTableConfig(tbl).columns.find((c) => c.name === 'created_at')
    expect(createdAt?.columnType).toBe('SQLiteTimestamp')
  })
})

describe('lifecycleCheck()', () => {
  it('registers a CHECK constraint on the table', () => {
    const tbl = sqliteTable(
      'demo',
      {
        id: text('id').primaryKey(),
        status: text('status').notNull(),
      },
      (table) => [lifecycleCheck(table.status, ['active', 'archived'] as const)],
    )
    expect(getTableConfig(tbl).checks).toHaveLength(1)
    expect(getTableConfig(tbl).checks[0]?.name).toBe('status_check')
  })
})
