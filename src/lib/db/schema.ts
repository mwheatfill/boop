import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const healthChecks = sqliteTable('health_checks', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  checkedAt: integer('checked_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  status: text('status', { enum: ['ok', 'error'] }).notNull(),
  detail: text('detail'),
})

export type HealthCheck = typeof healthChecks.$inferSelect
export type NewHealthCheck = typeof healthChecks.$inferInsert
