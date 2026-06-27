import { nameField, slugField } from './fields'
import { z } from './openapi'
import { tzSchema } from './timezone'
import { VariableMapSchema } from './workspace-variables'

const autotaskCompanyIdField = z.string().trim().min(1).max(64).optional()

export const WorkspaceSchema = z
  .object({
    id: z.string().meta({ example: 'cust_abc123' }),
    name: z.string().meta({ example: 'Acme' }),
    slug: z.string().meta({ example: 'acme' }),
    timezone: tzSchema,
    autotaskCompanyId: z.string().nullable().meta({ example: '12345' }),
    status: z.enum(['active', 'archived']),
    variables: VariableMapSchema,
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .meta({
    id: 'Workspace',
    description: 'A workspace organization that owns Targets, Jobs, and Channels.',
  })

export type Workspace = z.infer<typeof WorkspaceSchema>

export const WorkspaceCreateInput = z
  .object({
    name: nameField,
    slug: slugField,
    timezone: tzSchema,
    autotaskCompanyId: autotaskCompanyIdField,
  })
  .meta({ id: 'WorkspaceCreateInput' })

export type WorkspaceCreateInput = z.infer<typeof WorkspaceCreateInput>

export const WorkspaceUpdateInput = z
  .object({
    name: nameField,
    timezone: tzSchema,
    autotaskCompanyId: autotaskCompanyIdField,
    variables: VariableMapSchema.optional(),
  })
  .meta({ id: 'WorkspaceUpdateInput' })

export type WorkspaceUpdateInput = z.infer<typeof WorkspaceUpdateInput>
