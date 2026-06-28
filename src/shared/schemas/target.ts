import { nameField, slugField } from './fields'
import { z } from './openapi'

export const TARGET_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD'] as const
export const TARGET_AUTH_KINDS = ['none', 'bearer', 'basic', 'header'] as const
export const TARGET_REACHABILITIES = ['public', 'tunnel'] as const

const urlField = z.url('Must be a valid URL').max(2048)
const originField = z
  .url('Must be a valid origin URL (e.g. http://10.0.1.50:8080)')
  .max(2048)
  .meta({ example: 'http://10.0.1.50:8080' })

export const TargetSchema = z
  .object({
    id: z.string().meta({ example: 'tgt_abc123' }),
    workspaceId: z.string().meta({ example: 'cust_abc123' }),
    name: z.string().meta({ example: 'Primary API' }),
    slug: z.string().meta({ example: 'primary-api' }),
    url: z.string().meta({ example: 'https://api.acme.com/healthz' }),
    method: z.enum(TARGET_METHODS),
    authKind: z.enum(TARGET_AUTH_KINDS),
    authConfig: z.string().nullable(),
    reachability: z.enum(TARGET_REACHABILITIES),
    tunnelId: z.string().nullable(),
    internalOrigin: z.string().nullable(),
    status: z.enum(['active', 'archived']),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .meta({
    id: 'Target',
    description: 'A reusable HTTP destination owned by a Workspace.',
  })

export type Target = z.infer<typeof TargetSchema>

const targetMutableFields = {
  name: nameField,
  // Optional: public targets supply url; tunnel targets supply internalOrigin and
  // boop generates the url from the chosen tunnel's hostname.
  url: urlField.optional(),
  method: z.enum(TARGET_METHODS),
  authKind: z.enum(TARGET_AUTH_KINDS),
  authConfig: z.string().max(4096).nullable().optional(),
  reachability: z.enum(TARGET_REACHABILITIES),
  tunnelId: z.string().nullable().optional(),
  internalOrigin: originField.nullable().optional(),
}

export const TargetCreateInput = z
  .object({ ...targetMutableFields, slug: slugField })
  .meta({ id: 'TargetCreateInput' })

export type TargetCreateInput = z.infer<typeof TargetCreateInput>

export const TargetUpdateInput = z.object(targetMutableFields).meta({ id: 'TargetUpdateInput' })

export type TargetUpdateInput = z.infer<typeof TargetUpdateInput>
