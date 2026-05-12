import { getTableConfig, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { describe, expect, it } from 'vitest'
import { enumColumn, lifecycleCheck, timestamps } from './columns'

describe('timestamps()', () => {
  it('adds created_at and updated_at columns', () => {
    const tbl = sqliteTable('demo', { id: text('id').primaryKey(), ...timestamps() })
    const names = getTableConfig(tbl).columns.map((c) => c.name)
    expect(names).toContain('created_at')
    expect(names).toContain('updated_at')
  })
})

describe('enumColumn()', () => {
  it('produces a text column with the given name', () => {
    const tbl = sqliteTable('demo', {
      id: text('id').primaryKey(),
      kind: enumColumn('kind', ['a', 'b'] as const).notNull(),
    })
    const kind = getTableConfig(tbl).columns.find((c) => c.name === 'kind')
    expect(kind).toBeDefined()
    expect(kind?.notNull).toBe(true)
  })
})

describe('lifecycleCheck()', () => {
  it('registers a CHECK constraint named <column>_check', () => {
    const tbl = sqliteTable(
      'demo',
      { id: text('id').primaryKey(), status: text('status').notNull() },
      (table) => [lifecycleCheck(table.status, ['active', 'archived'] as const)],
    )
    expect(getTableConfig(tbl).checks).toHaveLength(1)
    expect(getTableConfig(tbl).checks[0]?.name).toBe('status_check')
  })
})
