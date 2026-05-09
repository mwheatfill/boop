// Contract for recipes to consume. The template doesn't call createDb itself;
// recipes that need DB access (auth/better-auth, app-specific recipes) import
// it. Keep the wiring identical across recipes by sourcing from here.

import { drizzle } from 'drizzle-orm/d1'
import * as schema from './schema'

export type Database = ReturnType<typeof drizzle<typeof schema>>

export function createDb(d1: D1Database): Database {
  return drizzle(d1, { schema })
}
