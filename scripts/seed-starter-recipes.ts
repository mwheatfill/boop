import { seedStarterRecipes } from '@/lib/job-templates/commands'
import { openLocalD1 } from './seed-demo/local-db'

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to run with NODE_ENV=production.')
  }
  const handle = openLocalD1()
  try {
    const changed = await seedStarterRecipes(handle.db)
    console.log(`seed:starters: upserted ${changed} starter recipes`)
  } finally {
    handle.sqlite.close()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
