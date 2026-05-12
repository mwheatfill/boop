import { createDocument } from 'zod-openapi'
import pkg from '../package.json' with { type: 'json' }
import { UserSchema } from '../src/shared/schemas/auth'
import {
  CustomerCreateInput,
  CustomerSchema,
  CustomerUpdateInput,
} from '../src/shared/schemas/customer'
import {
  JobCreateInput,
  JobSchema,
  JobSummarySchema,
  JobUpdateInput,
} from '../src/shared/schemas/job'
import { AttemptSummarySchema, RunSchema } from '../src/shared/schemas/run'
import { TargetCreateInput, TargetSchema, TargetUpdateInput } from '../src/shared/schemas/target'

export const document = createDocument({
  openapi: '3.1.0',
  info: {
    title: 'boop',
    version: pkg.version,
    description:
      'Generated from Zod schemas. Single source of truth for the API contract. ' +
      'The template ships no endpoints; add paths here as your app grows.',
  },
  paths: {},
  components: {
    schemas: {
      User: UserSchema,
      Customer: CustomerSchema,
      CustomerCreateInput,
      CustomerUpdateInput,
      Target: TargetSchema,
      TargetCreateInput,
      TargetUpdateInput,
      Job: JobSchema,
      JobSummary: JobSummarySchema,
      JobCreateInput,
      JobUpdateInput,
      Run: RunSchema,
      AttemptSummary: AttemptSummarySchema,
    },
  },
})

export const serialized = `${JSON.stringify(document, null, 2)}\n`
