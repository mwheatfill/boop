import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createDocument } from 'zod-openapi'
import { UserSchema } from '../src/shared/schemas/auth'
import { z } from '../src/shared/schemas/openapi'

const ErrorSchema = z
  .object({
    error: z.string().meta({ example: 'Unauthenticated' }),
  })
  .meta({ id: 'Error' })

const document = createDocument({
  openapi: '3.1.0',
  info: {
    title: 'template-cf-fullstack',
    version: '0.0.0',
    description: 'Generated from Zod schemas. Single source of truth for the API contract.',
  },
  paths: {
    '/api/me': {
      get: {
        summary: 'Current user',
        description: 'Returns the authenticated user, or 401 if no session.',
        operationId: 'getCurrentUser',
        tags: ['auth'],
        responses: {
          '200': {
            description: 'Authenticated user',
            content: {
              'application/json': { schema: UserSchema },
            },
          },
          '401': {
            description: 'Unauthenticated',
            content: {
              'application/json': { schema: ErrorSchema },
            },
          },
        },
      },
    },
  },
})

const outputPath = resolve(process.cwd(), 'openapi.json')
writeFileSync(outputPath, `${JSON.stringify(document, null, 2)}\n`)
console.log(`Wrote ${outputPath}`)
