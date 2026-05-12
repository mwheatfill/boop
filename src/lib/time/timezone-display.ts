export interface TimezoneOption {
  iana: string
  city: string
  region?: string
  commonName?: string
}

export const CURATED_TIMEZONES: readonly TimezoneOption[] = [
  { iana: 'UTC', city: 'UTC', commonName: 'Coordinated Universal Time' },
  { iana: 'America/New_York', city: 'New York', region: 'US', commonName: 'Eastern' },
  { iana: 'America/Chicago', city: 'Chicago', region: 'US', commonName: 'Central' },
  { iana: 'America/Denver', city: 'Denver', region: 'US', commonName: 'Mountain' },
  {
    iana: 'America/Phoenix',
    city: 'Phoenix',
    region: 'US Arizona',
    commonName: 'Mountain (no DST)',
  },
  { iana: 'America/Los_Angeles', city: 'Los Angeles', region: 'US', commonName: 'Pacific' },
  { iana: 'America/Anchorage', city: 'Anchorage', region: 'US', commonName: 'Alaska' },
  { iana: 'Pacific/Honolulu', city: 'Honolulu', region: 'US Hawaii', commonName: 'Hawaii' },
]

const CURATED_BY_IANA = new Map(CURATED_TIMEZONES.map((o) => [o.iana, o]))

function humanizeCity(part: string): string {
  return part.replace(/_/g, ' ')
}

export function describeTimezone(iana: string): TimezoneOption {
  const curated = CURATED_BY_IANA.get(iana)
  if (curated) return curated
  const segments = iana.split('/')
  const tail = segments[segments.length - 1] ?? iana
  const head = segments.length > 1 ? segments[0] : undefined
  return { iana, city: humanizeCity(tail), ...(head ? { region: head } : {}) }
}

const OFFSET_FORMATTER_CACHE = new Map<string, Intl.DateTimeFormat>()

function getOffsetFormatter(iana: string): Intl.DateTimeFormat | null {
  if (OFFSET_FORMATTER_CACHE.has(iana)) return OFFSET_FORMATTER_CACHE.get(iana) ?? null
  try {
    const fmt = new Intl.DateTimeFormat('en-US', { timeZone: iana, timeZoneName: 'shortOffset' })
    OFFSET_FORMATTER_CACHE.set(iana, fmt)
    return fmt
  } catch {
    return null
  }
}

export function formatTimezoneOffset(iana: string, now: Date = new Date()): string {
  const fmt = getOffsetFormatter(iana)
  if (!fmt) return ''
  const part = fmt.formatToParts(now).find((p) => p.type === 'timeZoneName')
  if (!part) return ''
  const raw = part.value
  if (raw === 'GMT') return 'UTC'
  return raw.startsWith('GMT') ? `UTC${raw.slice(3)}` : raw
}

const CLOCK_FORMATTER_CACHE = new Map<string, Intl.DateTimeFormat>()

function getClockFormatter(iana: string): Intl.DateTimeFormat | null {
  if (CLOCK_FORMATTER_CACHE.has(iana)) return CLOCK_FORMATTER_CACHE.get(iana) ?? null
  try {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: iana,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
    CLOCK_FORMATTER_CACHE.set(iana, fmt)
    return fmt
  } catch {
    return null
  }
}

export function formatTimezoneClock(iana: string, now: Date = new Date()): string {
  const fmt = getClockFormatter(iana)
  return fmt ? fmt.format(now) : ''
}

export function listAllTimezones(): string[] {
  try {
    return Intl.supportedValuesOf('timeZone')
  } catch {
    return CURATED_TIMEZONES.map((o) => o.iana)
  }
}
