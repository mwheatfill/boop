import { join } from 'node:path'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import type { Database as RuntimeDatabase } from './client'
import * as schema from './schema'

const MIGRATIONS_DIR = join(process.cwd(), 'drizzle')

// The cast is safe because nothing under test exercises D1-only methods
// (notably .batch()); Drizzle's insert/select/update query builders are
// identical across drivers.
export function createTestDb(): RuntimeDatabase {
  const sqlite = new Database(':memory:')
  sqlite.pragma('foreign_keys = ON')
  const db = drizzle(sqlite, { schema })
  migrate(db, { migrationsFolder: MIGRATIONS_DIR })
  return db as unknown as RuntimeDatabase
}
