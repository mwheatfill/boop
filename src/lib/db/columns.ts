import { sql } from 'drizzle-orm'
import { type AnySQLiteColumn, check, integer, text } from 'drizzle-orm/sqlite-core'

export function timestamps() {
  return {
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  }
}

export function enumColumn<T extends readonly [string, ...string[]]>(name: string, _values: T) {
  return text(name).$type<T[number]>()
}

export function lifecycleCheck<T extends readonly string[]>(column: AnySQLiteColumn, values: T) {
  const list = values.map((v) => `'${v.replace(/'/g, "''")}'`).join(', ')
  return check(`${column.name}_check`, sql.raw(`"${column.name}" IN (${list})`))
}
