import { z } from './openapi'

const VARIABLE_NAME_PATTERN = /^[a-z][a-z0-9_]{0,63}$/
const MAX_VARIABLE_KEYS = 64
const MAX_VARIABLE_VALUE_LEN = 4096

export const VariableNameSchema = z
  .string()
  .regex(
    VARIABLE_NAME_PATTERN,
    'Use lowercase letters, digits, and underscores (start with a letter)',
  )
  .meta({ id: 'VariableName', example: 'tenant_id' })

export const VariableValueSchema = z
  .string()
  .max(MAX_VARIABLE_VALUE_LEN, `Values must be ${MAX_VARIABLE_VALUE_LEN} characters or fewer`)
  .meta({ id: 'VariableValue', example: 'acme-123' })

export const VariableMapSchema = z
  .record(VariableNameSchema, VariableValueSchema)
  .refine((m) => Object.keys(m).length <= MAX_VARIABLE_KEYS, {
    message: `At most ${MAX_VARIABLE_KEYS} variables`,
  })
  .meta({
    id: 'VariableMap',
    description:
      'Operator-defined variables. Keys match ^[a-z][a-z0-9_]{0,63}$. Up to 64 entries. Customer-level entries are inherited by Jobs; Job-level entries override by name.',
  })

export type VariableMap = z.infer<typeof VariableMapSchema>

export function isValidVariableName(name: string): boolean {
  return VARIABLE_NAME_PATTERN.test(name)
}

export const VARIABLE_CONSTRAINTS = {
  maxKeys: MAX_VARIABLE_KEYS,
  maxValueLength: MAX_VARIABLE_VALUE_LEN,
  namePattern: VARIABLE_NAME_PATTERN,
} as const
