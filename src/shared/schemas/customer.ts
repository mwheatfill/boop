import { nameField, slugField } from './fields'
import { z } from './openapi'
import { tzSchema } from './timezone'

const autotaskCompanyIdField = z.string().trim().min(1).max(64).optional()

export const CustomerSchema = z
  .object({
    id: z.string().meta({ example: 'cust_abc123' }),
    name: z.string().meta({ example: 'Acme' }),
    slug: z.string().meta({ example: 'acme' }),
    timezone: tzSchema,
    autotaskCompanyId: z.string().nullable().meta({ example: '12345' }),
    status: z.enum(['active', 'archived']),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .meta({
    id: 'Customer',
    description: 'A customer organization that owns Targets, Jobs, and Channels.',
  })

export type Customer = z.infer<typeof CustomerSchema>

export const CustomerCreateInput = z
  .object({
    name: nameField,
    slug: slugField,
    timezone: tzSchema,
    autotaskCompanyId: autotaskCompanyIdField,
  })
  .meta({ id: 'CustomerCreateInput' })

export type CustomerCreateInput = z.infer<typeof CustomerCreateInput>

export const CustomerUpdateInput = z
  .object({
    name: nameField,
    timezone: tzSchema,
    autotaskCompanyId: autotaskCompanyIdField,
  })
  .meta({ id: 'CustomerUpdateInput' })

export type CustomerUpdateInput = z.infer<typeof CustomerUpdateInput>
