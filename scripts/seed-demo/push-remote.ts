import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { FK_INSERT_ORDER, splitDumpByTable, stripTrackingInserts } from './dump'

// DELETE statements walk the FK graph in reverse so children are gone before
// their parents. customers and users (the seed_tag roots) come last.
const RESET_REMOTE_SQL = `
DELETE FROM attempts WHERE run_id IN (
  SELECT id FROM runs WHERE customer_id IN (SELECT id FROM customers WHERE seed_tag = 'demo-v1')
);
DELETE FROM runs WHERE customer_id IN (SELECT id FROM customers WHERE seed_tag = 'demo-v1');
DELETE FROM jobs WHERE customer_id IN (SELECT id FROM customers WHERE seed_tag = 'demo-v1');
DELETE FROM targets WHERE customer_id IN (SELECT id FROM customers WHERE seed_tag = 'demo-v1');
DELETE FROM customers WHERE seed_tag = 'demo-v1';
DELETE FROM users WHERE seed_tag = 'demo-v1';
`.trim()

type Cli = {
  env: string | undefined
  reset: boolean
}

function parseCli(): Cli {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    strict: true,
    allowPositionals: false,
    options: {
      env: { type: 'string' },
      reset: { type: 'boolean', default: false },
      help: { type: 'boolean', default: false, short: 'h' },
    },
  })
  if (values.help) {
    console.log(
      [
        'pnpm seed:remote [--env=<wrangler-env>] [--reset]',
        '',
        '  --env=<name>   Pass --env=<name> to every wrangler call. Defaults to the top-level binding.',
        '  --reset        Delete every seed_tag = demo-v1 row on remote before importing.',
        '',
        'Assumes you have run `pnpm seed:demo` so the local D1 file holds the demo dataset.',
        'Imports happen via `wrangler d1 export --local` + `wrangler d1 execute --remote --file`,',
        'split by table in FK-dependency order.',
      ].join('\n'),
    )
    process.exit(0)
  }
  return { env: values.env, reset: Boolean(values.reset) }
}

function fail(message: string): never {
  console.error(`seed:remote: ${message}`)
  process.exit(1)
}

// Post-import polling on D1's REST API can briefly return this status after the
// import has succeeded; wrangler surfaces it as exit-1 even though every query
// in the file ran. The phrase is the literal one the cloudflare-docs REST-API
// tutorial says to treat as benign in its own polling loop.
const POST_IMPORT_FALSE_NEGATIVE = 'Not currently importing anything.'

function wrangler(env: string | undefined, args: string[]): void {
  const wrappedArgs = ['exec', 'wrangler', ...args]
  if (env) wrappedArgs.push(`--env=${env}`)
  const result = spawnSync('pnpm', wrappedArgs, { stdio: ['inherit', 'inherit', 'pipe'] })
  if (result.stderr) process.stderr.write(result.stderr)
  if (result.status === 0) return
  const stderr = result.stderr?.toString() ?? ''
  if (stderr.includes(POST_IMPORT_FALSE_NEGATIVE)) {
    console.log(`seed:remote: (ignoring post-import status from wrangler)`)
    return
  }
  fail(`wrangler ${args.join(' ')} exited with status ${result.status ?? 'null'}`)
}

function main(): void {
  if (process.env.NODE_ENV === 'production') {
    fail('Refusing to run with NODE_ENV=production.')
  }
  const cli = parseCli()
  const startedAt = Date.now()
  const workDir = mkdtempSync(join(tmpdir(), 'seed-demo-remote-'))
  const dumpPath = join(workDir, 'dump.sql')

  try {
    console.log(`seed:remote: exporting local D1 to ${dumpPath}…`)
    wrangler(undefined, ['d1', 'export', 'DB', '--local', `--output=${dumpPath}`, '--no-schema'])

    const rawDump = readFileSync(dumpPath, 'utf8')
    const dump = stripTrackingInserts(rawDump)
    const buckets = splitDumpByTable(dump)
    const totalRows = [...buckets.values()].reduce((acc, rows) => acc + rows.length, 0)
    if (totalRows === 0) {
      fail('local dump has no rows in any seeded table. Did you run `pnpm seed:demo` first?')
    }

    if (cli.reset) {
      console.log('seed:remote: clearing seed_tag = demo-v1 rows on remote…')
      const resetPath = join(workDir, 'reset.sql')
      writeFileSync(resetPath, RESET_REMOTE_SQL)
      wrangler(cli.env, ['d1', 'execute', 'DB', '--remote', `--file=${resetPath}`])
    }

    for (const table of FK_INSERT_ORDER) {
      const rows = buckets.get(table) ?? []
      if (rows.length === 0) continue
      const tablePath = join(workDir, `${table}.sql`)
      writeFileSync(tablePath, rows.join('\n'))
      console.log(`seed:remote: importing ${table} (${rows.length} rows)…`)
      wrangler(cli.env, ['d1', 'execute', 'DB', '--remote', `--file=${tablePath}`])
    }

    const durationS = ((Date.now() - startedAt) / 1000).toFixed(1)
    console.log(
      `seed:remote: done in ${durationS}s — pushed ${totalRows} rows across ${FK_INSERT_ORDER.length} tables`,
    )
  } finally {
    rmSync(workDir, { recursive: true, force: true })
  }
}

main()
