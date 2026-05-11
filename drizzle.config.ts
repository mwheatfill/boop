import { defineConfig } from 'drizzle-kit'

// db:generate doesn't connect; db:studio and db:push do. Lazy-reading
// envs lets generate work without creds; drizzle-kit fails at connect
// time with its own message if studio/push run without them.
export default defineConfig({
  schema: './src/lib/db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  driver: 'd1-http',
  dbCredentials: {
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID ?? '',
    databaseId: process.env.CLOUDFLARE_DATABASE_ID ?? '',
    token: process.env.CLOUDFLARE_D1_TOKEN ?? '',
  },
  verbose: true,
  strict: true,
})
