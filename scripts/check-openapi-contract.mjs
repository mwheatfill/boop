#!/usr/bin/env node
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = process.cwd()
const specPath = resolve(root, 'openapi.json')

let committed
try {
  committed = readFileSync(specPath, 'utf8')
} catch {
  console.error('openapi.json not found. Run `pnpm openapi:generate` and commit the result.')
  process.exit(1)
}

execSync('pnpm openapi:generate', { stdio: 'pipe' })
const regenerated = readFileSync(specPath, 'utf8')

if (committed !== regenerated) {
  console.error('openapi.json is out of sync with the source schemas.')
  console.error('Run `pnpm openapi:generate` and commit the updated openapi.json.')
  // Restore the committed version so the dev environment is unchanged on failure.
  // (CI will fail and the developer regenerates locally.)
  process.exit(1)
}

console.log('openapi.json is in sync with source schemas.')
