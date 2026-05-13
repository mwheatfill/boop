#!/usr/bin/env tsx
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

const REPO_URL = 'https://github.com/mwheatfill/app-platform-recipes.git'

type Recipe = {
  id: string
  domain: string
  name: string
  description: string
  templates: string[]
  implements?: string
  requires: string[]
  dependsOn: string[]
  providesEnvVars: string[]
  hasInstallScript: boolean
  notes?: string
}

type Manifest = { version: number; recipes: Recipe[] }

type Flags = {
  from?: string
  ref: string
  force: boolean
  rest: string[]
}

function parseFlags(argv: string[]): Flags {
  const out: Flags = { ref: 'main', force: false, rest: [] }
  const takeValue = (flag: string, i: number): string => {
    const v = argv[i]
    if (v === undefined) {
      console.error(`${flag} requires a value`)
      process.exit(1)
    }
    return v
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === undefined) continue
    if (a === '--from') out.from = takeValue(a, ++i)
    else if (a === '--ref') out.ref = takeValue(a, ++i)
    else if (a === '--force') out.force = true
    else if (a === '-h' || a === '--help') {
      printUsage()
      process.exit(0)
    } else if (a.startsWith('--')) {
      console.error(`Unknown flag: ${a}`)
      process.exit(1)
    } else {
      out.rest.push(a)
    }
  }
  return out
}

function printUsage(): void {
  console.log(`Usage:
  pnpm recipe install <id> [<id>...] [--from <path>] [--ref <branch>] [--force]
  pnpm recipe list [--from <path>] [--ref <branch>]

Recipe id is <domain>/<name>, e.g. auth/cloudflare-access.

Flags:
  --from <path>   use a local checkout of app-platform-recipes (skips clone)
  --ref <branch>  git ref to clone (default: main)
  --force         pass --force through to per-recipe installers
`)
}

function acquireSource(from: string | undefined, ref: string): string {
  if (from) {
    const root = path.resolve(from)
    if (!existsSync(path.join(root, 'recipes.json'))) {
      console.error(`recipes.json not found in ${root}`)
      process.exit(1)
    }
    return root
  }
  const tmp = mkdtempSync(path.join(tmpdir(), 'app-platform-recipes-'))
  process.on('exit', () => rmSync(tmp, { recursive: true, force: true }))
  console.log(`▶ Cloning recipes (${ref})...`)
  const r = spawnSync('git', ['clone', '--depth', '1', '--branch', ref, REPO_URL, tmp], {
    stdio: ['ignore', 'ignore', 'inherit'],
  })
  if (r.status !== 0) {
    console.error(`git clone failed (exit ${r.status})`)
    process.exit(1)
  }
  return tmp
}

function loadManifest(root: string): Manifest {
  const raw = readFileSync(path.join(root, 'recipes.json'), 'utf8')
  return JSON.parse(raw) as Manifest
}

function resolveInstallOrder(requested: string[], byId: Map<string, Recipe>): string[] {
  for (const id of requested) {
    if (!byId.has(id)) {
      console.error(`Unknown recipe: ${id}`)
      const suggestions = [...byId.values()].filter((r) => r.id.includes(id)).slice(0, 5)
      if (suggestions.length) {
        console.error(`Did you mean: ${suggestions.map((r) => r.id).join(', ')}?`)
      }
      process.exit(1)
    }
  }

  const order: string[] = []
  const visited = new Set<string>()
  const stack = new Set<string>()

  function visit(id: string, trail: string[]): void {
    if (visited.has(id)) return
    if (stack.has(id)) {
      const cycle = [...trail.slice(trail.indexOf(id)), id].join(' -> ')
      console.error(`Cycle in requires graph: ${cycle}`)
      process.exit(1)
    }
    stack.add(id)
    const recipe = byId.get(id)
    if (!recipe) {
      console.error(`Missing required recipe: ${id} (referenced by ${trail.at(-1) ?? '<root>'})`)
      process.exit(1)
    }
    for (const dep of recipe.requires) visit(dep, [...trail, id])
    stack.delete(id)
    visited.add(id)
    order.push(id)
  }

  for (const id of requested) visit(id, [])
  return order
}

function reportUnsatisfiedCapabilities(order: string[], byId: Map<string, Recipe>): void {
  const provided = new Set<string>()
  for (const id of order) {
    const r = byId.get(id)
    if (r?.implements) provided.add(r.implements)
  }
  const unmet: { id: string; capability: string }[] = []
  for (const id of order) {
    const r = byId.get(id)
    if (!r) continue
    for (const cap of r.dependsOn) {
      if (!provided.has(cap)) unmet.push({ id, capability: cap })
    }
  }
  if (unmet.length === 0) return
  console.warn('')
  console.warn('⚠ Capability dependencies not satisfied by the install set:')
  for (const { id, capability } of unmet) {
    const providers = [...byId.values()].filter((r) => r.implements === capability)
    const list = providers.length
      ? providers.map((r) => r.id).join(', ')
      : '(no recipes implement this capability)'
    console.warn(`  ${id} expects "${capability}" — providers: ${list}`)
  }
  console.warn('Install one of the listed providers before depending on these recipes.')
  console.warn('')
}

function installRecipe(root: string, id: string, force: boolean): void {
  console.log('')
  console.log(`▶ Installing ${id}`)
  const args = [path.join(root, 'install.sh'), '--from', root, ...(force ? ['--force'] : []), id]
  const r = spawnSync('bash', args, { stdio: 'inherit' })
  if (r.status !== 0) {
    console.error(`✗ Recipe ${id} failed (exit ${r.status})`)
    process.exit(r.status ?? 1)
  }
}

function commandInstall(flags: Flags): void {
  if (flags.rest.length === 0) {
    console.error('Usage: pnpm recipe install <id> [<id>...]')
    process.exit(1)
  }
  const root = acquireSource(flags.from, flags.ref)
  const manifest = loadManifest(root)
  const byId = new Map(manifest.recipes.map((r) => [r.id, r]))
  const order = resolveInstallOrder(flags.rest, byId)
  reportUnsatisfiedCapabilities(order, byId)
  console.log(`Install plan: ${order.join(' → ')}`)
  for (const id of order) installRecipe(root, id, flags.force)
  console.log('')
  console.log(`✅ Installed ${order.length} recipe${order.length === 1 ? '' : 's'}.`)
}

function commandList(flags: Flags): void {
  const root = acquireSource(flags.from, flags.ref)
  const manifest = loadManifest(root)
  const byDomain = new Map<string, Recipe[]>()
  for (const r of manifest.recipes) {
    if (!byDomain.has(r.domain)) byDomain.set(r.domain, [])
    byDomain.get(r.domain)?.push(r)
  }
  for (const [domain, recipes] of Array.from(byDomain.entries()).sort()) {
    console.log(`\n${domain}/`)
    for (const r of recipes) {
      const reqSuffix = r.requires.length ? ` (requires: ${r.requires.join(', ')})` : ''
      console.log(`  ${r.name}${reqSuffix}`)
    }
  }
}

const [, , subcommand, ...rest] = process.argv
const flags = parseFlags(rest)
switch (subcommand) {
  case 'install':
    commandInstall(flags)
    break
  case 'list':
    commandList(flags)
    break
  case undefined:
  case '-h':
  case '--help':
    printUsage()
    break
  default:
    console.error(`Unknown subcommand: ${subcommand}`)
    printUsage()
    process.exit(1)
}
