import { z } from './openapi'

function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz })
    return true
  } catch {
    return false
  }
}

export const tzSchema = z
  .string()
  .refine(isValidTimezone, {
    message: 'Must be a valid IANA timezone (e.g. America/New_York, UTC)',
  })
  .meta({
    id: 'Timezone',
    description: 'IANA timezone identifier.',
    example: 'America/New_York',
  })

export type Timezone = z.infer<typeof tzSchema>
