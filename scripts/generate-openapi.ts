import { writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { serialized } from './openapi-document'

const outputPath = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'openapi.json')
writeFileSync(outputPath, serialized)
console.log(`Wrote ${outputPath}`)
