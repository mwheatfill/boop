import { z } from './openapi'

export const FieldErrorsSchema = z.record(z.string(), z.array(z.string())).meta({
  id: 'FieldErrors',
  description: 'Per-field validation messages, keyed by field name.',
  example: { name: ['Name is required'] },
})

export const MutationFailureSchema = z
  .object({
    ok: z.literal(false),
    fieldErrors: FieldErrorsSchema.optional(),
    message: z.string().optional().meta({
      example:
        'This Tunnel is used by 1 active Target. Archive that Target before removing this Tunnel.',
    }),
  })
  .meta({
    id: 'MutationFailure',
    description:
      'Failure envelope returned by mutating server functions (the ok:false branch of MutationResult). ' +
      'Success responses carry the operation-specific payload under the ok:true branch.',
  })

export type FieldErrors = z.infer<typeof FieldErrorsSchema>
export type MutationFailure = z.infer<typeof MutationFailureSchema>
