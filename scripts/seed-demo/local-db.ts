import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import type { Database as RuntimeDatabase } from '@/lib/db/client'
import * as schema from '@/lib/db/schema'

const WRANGLER_D1_DIR = '.wrangler/state/v3/d1/miniflare-D1DatabaseObject'

export type LocalDbHandle = {
  db: RuntimeDatabase
  sqlite: Database.Database
  filePath: string
}

export function openLocalD1(): LocalDbHandle {
  const dir = join(process.cwd(), WRANGLER_D1_DIR)
  if (!existsSync(dir)) {
    throw new Error(
      `Local D1 directory not found at ${dir}. Run \`pnpm db:migrate:local\` first to initialize the dev database.`,
    )
  }
  const files = readdirSync(dir).filter((f) => f.endsWith('.sqlite') && f !== 'metadata.sqlite')
  if (files.length === 0) {
    throw new Error(
      `No D1 sqlite file found in ${dir}. Run \`pnpm db:migrate:local\` to materialize one.`,
    )
  }
  if (files.length > 1) {
    throw new Error(
      `Multiple D1 sqlite files found in ${dir} (${files.join(', ')}). Remove the stale ones before seeding.`,
    )
  }
  const filePath = join(dir, files[0]!)
  const sqlite = new Database(filePath)
  sqlite.pragma('foreign_keys = ON')
  sqlite.pragma('journal_mode = WAL')
  // The cast matches createTestDb in src/lib/db/test-db.ts — better-sqlite3
  // exposes the same insert/select/update query builders Drizzle's D1 driver does.
  const db = drizzle(sqlite, { schema }) as unknown as RuntimeDatabase
  return { db, sqlite, filePath }
}
