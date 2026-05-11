import { defineConfig } from 'drizzle-kit'

function requiredEnv(key: string): string {
  const value = process.env[key]
  if (!value) throw new Error(`Missing env var: ${key}`)
  return value
}

export default defineConfig({
  schema: './src/lib/db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  driver: 'd1-http',
  dbCredentials: {
    accountId: requiredEnv('CLOUDFLARE_ACCOUNT_ID'),
    databaseId: requiredEnv('CLOUDFLARE_DATABASE_ID'),
    token: requiredEnv('CLOUDFLARE_D1_TOKEN'),
  },
  verbose: true,
  strict: true,
})
