import { isLiquidIdentifier, LIQUID_IDENTIFIER_MESSAGE, LIQUID_IDENTIFIER_PATTERN } from './fields'
import { z } from './openapi'

const MAX_VARIABLE_KEYS = 64
const MAX_VARIABLE_VALUE_LEN = 4096

export const VariableNameSchema = z
  .string()
  .regex(LIQUID_IDENTIFIER_PATTERN, LIQUID_IDENTIFIER_MESSAGE)
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

export const isValidVariableName = isLiquidIdentifier

export const VARIABLE_CONSTRAINTS = {
  maxKeys: MAX_VARIABLE_KEYS,
  maxValueLength: MAX_VARIABLE_VALUE_LEN,
  namePattern: LIQUID_IDENTIFIER_PATTERN,
} as const

export function mergeEffectiveVariables(
  customerVars: Record<string, string>,
  jobVars: Record<string, string>,
): Record<string, string> {
  return { ...customerVars, ...jobVars }
}
