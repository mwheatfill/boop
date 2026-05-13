import { z } from './openapi'

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export const slugField = z
  .string()
  .min(1, 'Slug is required')
  .max(64, 'Slug must be 64 characters or fewer')
  .regex(SLUG_PATTERN, 'Slug must be lowercase letters, digits, and hyphens')

export const nameField = z.string().trim().min(1, 'Name is required').max(120)

export const LIQUID_IDENTIFIER_PATTERN = /^[a-z][a-z0-9_]{0,63}$/
export const LIQUID_IDENTIFIER_MESSAGE =
  'Use lowercase letters, digits, and underscores (start with a letter)'

export function isLiquidIdentifier(value: string): boolean {
  return LIQUID_IDENTIFIER_PATTERN.test(value)
}
