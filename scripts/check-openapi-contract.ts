import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { serialized as expected } from './openapi-document'

const specPath = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'openapi.json')

let committed: string
try {
  committed = readFileSync(specPath, 'utf8')
} catch {
  console.error('openapi.json not found. Run `pnpm openapi:generate` and commit the result.')
  process.exit(1)
}

if (committed !== expected) {
  console.error('openapi.json is out of sync with the source schemas.')
  console.error('Run `pnpm openapi:generate` and commit the updated openapi.json.')
  process.exit(1)
}

console.log('openapi.json is in sync with source schemas.')
