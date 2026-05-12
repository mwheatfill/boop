import { z } from './openapi'

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export const slugField = z
  .string()
  .min(1, 'Slug is required')
  .max(64, 'Slug must be 64 characters or fewer')
  .regex(SLUG_PATTERN, 'Slug must be lowercase letters, digits, and hyphens')

export const nameField = z.string().trim().min(1, 'Name is required').max(120)
