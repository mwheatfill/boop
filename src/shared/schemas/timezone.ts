import { z } from './openapi'

const KNOWN_TIMEZONES = new Set(Intl.supportedValuesOf('timeZone'))

function isValidTimezone(tz: string): boolean {
  if (KNOWN_TIMEZONES.has(tz)) return true
  try {
    Intl.DateTimeFormat('en-US', { timeZone: tz })
    KNOWN_TIMEZONES.add(tz)
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
