import { describe, expect, it } from 'vitest'
import { FK_INSERT_ORDER, splitDumpByTable, stripTrackingInserts } from './dump'

const sample = [
  'PRAGMA defer_foreign_keys=true;',
  "INSERT INTO \"alert_rules\" VALUES('rul_a','cust_a',null,...);",
  "INSERT INTO \"workspaces\" VALUES('cust_a','Acme',...);",
  "INSERT INTO \"d1_migrations\" VALUES(1,'0000_x.sql','now');",
  'INSERT INTO "sqlite_sequence" VALUES(\'d1_migrations\',8);',
  "INSERT INTO \"runs\" VALUES('run_a','job_a','cust_a',...);",
].join('\n')

describe('stripTrackingInserts', () => {
  it('removes d1_migrations and sqlite_sequence rows', () => {
    const stripped = stripTrackingInserts(sample)
    expect(stripped).not.toMatch(/d1_migrations/)
    expect(stripped).not.toMatch(/sqlite_sequence/)
    expect(stripped).toMatch(/INSERT INTO "workspaces"/)
    expect(stripped).toMatch(/INSERT INTO "runs"/)
  })
})

describe('splitDumpByTable', () => {
  it('returns one bucket per FK-order table', () => {
    const buckets = splitDumpByTable(sample)
    expect([...buckets.keys()]).toEqual([...FK_INSERT_ORDER])
  })

  it('routes each INSERT to the matching table bucket', () => {
    const buckets = splitDumpByTable(sample)
    expect(buckets.get('workspaces')).toHaveLength(1)
    expect(buckets.get('alert_rules')).toHaveLength(1)
    expect(buckets.get('runs')).toHaveLength(1)
    expect(buckets.get('attempts')).toHaveLength(0)
  })

  it('ignores non-INSERT lines and tracker-table inserts', () => {
    const buckets = splitDumpByTable(sample)
    const total = [...buckets.values()].reduce((acc, rows) => acc + rows.length, 0)
    expect(total).toBe(3)
  })
})
