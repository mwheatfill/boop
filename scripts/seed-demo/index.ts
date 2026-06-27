import { parseArgs } from 'node:util'
import { cleanupDemoData } from './cleanup'
import { openLocalD1 } from './local-db'
import { isProfile, type Profile } from './manifest'
import { seedDemoData } from './seed'

type Cli = {
  profile: Profile
  reset: boolean
  confirm: boolean
}

function parseCli(): Cli {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    strict: true,
    allowPositionals: false,
    options: {
      profile: { type: 'string', default: 'demo' },
      reset: { type: 'boolean', default: false },
      confirm: { type: 'boolean', default: false },
      help: { type: 'boolean', default: false, short: 'h' },
    },
  })
  if (values.help) {
    printHelp()
    process.exit(0)
  }
  const profile = values.profile ?? 'demo'
  if (!isProfile(profile)) {
    fail(`Unknown --profile=${profile}. Valid: demo, stress, minimal.`)
  }
  return {
    profile,
    reset: Boolean(values.reset),
    confirm: Boolean(values.confirm),
  }
}

function printHelp(): void {
  console.log(
    [
      'pnpm seed:demo [--profile=demo|stress|minimal] [--reset [--confirm]]',
      '',
      '  --profile=demo     14 days history (default)',
      '  --profile=stress   90 days history. Heavy on D1; --confirm required to reset.',
      '  --profile=minimal  3 days history, single Workspace, 5 Jobs. CI-friendly.',
      '  --reset            Delete every seed_tag = demo-v1 row before inserting.',
      '  --confirm          Required with --reset --profile=stress.',
    ].join('\n'),
  )
}

function fail(message: string): never {
  console.error(`seed:demo: ${message}`)
  process.exit(1)
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    fail('Refusing to run with NODE_ENV=production.')
  }
  const cli = parseCli()
  if (cli.reset && cli.profile === 'stress' && !cli.confirm) {
    fail('--reset on --profile=stress requires --confirm.')
  }

  const startedAt = Date.now()
  const handle = openLocalD1()
  console.log(`seed:demo: profile=${cli.profile} db=${handle.filePath}`)

  try {
    if (cli.reset) {
      console.log('seed:demo: cleanup phase…')
      const counts = await cleanupDemoData(handle.db)
      console.log(
        `seed:demo: cleanup deleted workspaces=${counts.workspaces} users=${counts.users} targets=${counts.targets} jobs=${counts.jobs} runs=${counts.runs} attempts=${counts.attempts}`,
      )
    }

    const counts = await seedDemoData(handle.db, {
      profile: cli.profile,
      onProgress: (event) => {
        if (event.kind === 'phase') {
          console.log(`seed:demo: ${event.message}`)
        }
      },
    })
    const durationMs = Date.now() - startedAt
    console.log(
      `seed:demo: done in ${(durationMs / 1000).toFixed(1)}s — workspaces=${counts.workspaces} operators=${counts.operators} targets=${counts.targets} jobs=${counts.jobs} channels=${counts.channels} alertRules=${counts.alertRules} runs=${counts.runs} attempts=${counts.attempts}`,
    )
  } finally {
    handle.sqlite.close()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
