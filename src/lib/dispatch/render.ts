import { Liquid, type TagToken, type TopLevelToken, Value } from 'liquidjs'

export interface RenderContext {
  runId: string
  attemptNumber: number
  customerName: string
  customerTimezone: string
  now: Date
  variables?: Record<string, unknown>
}

const ISO_DATE_FORMAT = new Map<string, Intl.DateTimeFormat>()

function isoFormatterFor(timeZone: string): Intl.DateTimeFormat {
  let fmt = ISO_DATE_FORMAT.get(timeZone)
  if (!fmt) {
    fmt = new Intl.DateTimeFormat('sv-SE', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
    ISO_DATE_FORMAT.set(timeZone, fmt)
  }
  return fmt
}

function toDate(value: unknown): Date {
  if (value instanceof Date) return value
  if (typeof value === 'number') return new Date(value)
  if (typeof value === 'string') return new Date(value)
  throw new TypeError(`iso_date: expected Date/number/string, got ${typeof value}`)
}

interface TzWrapped {
  __boopTz: true
  date: Date
  zone: string
}

function isTzWrapped(value: unknown): value is TzWrapped {
  return typeof value === 'object' && value !== null && (value as TzWrapped).__boopTz === true
}

const engine = new Liquid({
  strictFilters: true,
  strictVariables: false,
  greedy: false,
})

engine.registerFilter('tz', (value: unknown, zone: string): TzWrapped => {
  if (typeof zone !== 'string' || zone.length === 0) {
    throw new TypeError('tz: zone argument is required')
  }
  return { __boopTz: true, date: toDate(value), zone }
})

engine.registerFilter('iso_date', (value: unknown): string => {
  if (isTzWrapped(value)) {
    const parts = isoFormatterFor(value.zone).formatToParts(value.date)
    const pick = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
    return `${pick('year')}-${pick('month')}-${pick('day')}T${pick('hour')}:${pick('minute')}:${pick('second')}`
  }
  return toDate(value).toISOString()
})

engine.registerTag('boop_secret', {
  parse(tagToken: TagToken, _remainTokens: TopLevelToken[]) {
    this.value = new Value(tagToken.args, engine)
  },
  render() {
    throw new Error('boop_secret: secrets backend not yet implemented')
  },
})

export const BUILTIN_RENDER_VARIABLE_NAMES = [
  'run_id',
  'attempt_number',
  'customer_name',
  'customer_timezone',
  'now',
] as const

export type BuiltinRenderVariableName = (typeof BUILTIN_RENDER_VARIABLE_NAMES)[number]

export async function renderTemplate(template: string, context: RenderContext): Promise<string> {
  return engine.parseAndRender(template, {
    run_id: context.runId,
    attempt_number: context.attemptNumber,
    customer_name: context.customerName,
    customer_timezone: context.customerTimezone,
    now: context.now,
    ...(context.variables ?? {}),
  })
}
