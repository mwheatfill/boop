export const TRACKING_TABLES = ['d1_migrations', 'sqlite_sequence'] as const

// Insert order honors FK dependencies. workspaces and users are roots; targets
// depend on workspaces; jobs depend on workspaces + targets; channels and
// alert_rules depend on workspaces (and alert_rules optionally on jobs); runs
// depend on jobs + workspaces; attempts depend on runs.
export const FK_INSERT_ORDER = [
  'workspaces',
  'users',
  'targets',
  'jobs',
  'channels',
  'alert_rules',
  'runs',
  'attempts',
] as const

export type SeededTable = (typeof FK_INSERT_ORDER)[number]

export function stripTrackingInserts(dump: string): string {
  const skipPrefixes = TRACKING_TABLES.map((t) => `INSERT INTO "${t}"`)
  return dump
    .split('\n')
    .filter((line) => !skipPrefixes.some((p) => line.startsWith(p)))
    .join('\n')
}

export function splitDumpByTable(dump: string): Map<SeededTable, string[]> {
  const buckets = new Map<SeededTable, string[]>()
  for (const table of FK_INSERT_ORDER) buckets.set(table, [])
  const prefixForTable = new Map(FK_INSERT_ORDER.map((t) => [t, `INSERT INTO "${t}"`]))
  for (const line of dump.split('\n')) {
    for (const table of FK_INSERT_ORDER) {
      if (line.startsWith(prefixForTable.get(table) as string)) {
        buckets.get(table)?.push(line)
        break
      }
    }
  }
  return buckets
}
