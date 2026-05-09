import { writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createDocument } from 'zod-openapi'

const document = createDocument({
  openapi: '3.1.0',
  info: {
    title: 'template-cf-fullstack',
    version: '0.0.0',
    description:
      'Generated from Zod schemas. Single source of truth for the API contract. ' +
      'The template ships no endpoints; add paths here as your app grows.',
  },
  paths: {},
})

const outputPath = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'openapi.json')
writeFileSync(outputPath, `${JSON.stringify(document, null, 2)}\n`)
console.log(`Wrote ${outputPath}`)
