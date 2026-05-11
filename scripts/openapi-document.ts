import { createDocument } from 'zod-openapi'
import pkg from '../package.json' with { type: 'json' }
import { UserSchema } from '../src/shared/schemas/auth'

export const document = createDocument({
  openapi: '3.1.0',
  info: {
    title: 'template-cf-fullstack',
    version: pkg.version,
    description:
      'Generated from Zod schemas. Single source of truth for the API contract. ' +
      'The template ships no endpoints; add paths here as your app grows.',
  },
  paths: {},
  components: {
    schemas: {
      User: UserSchema,
    },
  },
})

export const serialized = `${JSON.stringify(document, null, 2)}\n`
