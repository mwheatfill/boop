// Single source of truth for the openapi.json document.
// Both `generate-openapi.ts` (writes to disk) and `check-openapi-contract.ts`
// (compares to disk without writing) import from here.

import { createDocument } from 'zod-openapi'

export const document = createDocument({
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

export const serialized = `${JSON.stringify(document, null, 2)}\n`
