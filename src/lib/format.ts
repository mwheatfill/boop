const ZERO_DECIMAL_CURRENCIES = new Set(['JPY', 'KRW', 'VND', 'CLP', 'ISK', 'UGX'])
const DEFAULT_NUMBER_FORMATTER = new Intl.NumberFormat('en-US')
const DEFAULT_PERCENT_FORMATTER = new Intl.NumberFormat('en-US', {
  style: 'percent',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})
const DEFAULT_LOCAL_DATE_TIME_FORMATTER = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})
const moneyFormatterCache = new Map<string, Intl.NumberFormat>()
const numberFormatterCache = new Map<string, Intl.NumberFormat>()
const percentFormatterCache = new Map<string, Intl.NumberFormat>()

function fractionDigitsFor(currency: string): number {
  return ZERO_DECIMAL_CURRENCIES.has(currency.toUpperCase()) ? 0 : 2
}

// Pass `minorUnits` as integer cents (or whole units for zero-decimal
// currencies). Storing money as floats invites 0.1 + 0.2 !== 0.3.
export function formatMoney(minorUnits: number, currency: string, locale = 'en-US'): string {
  const fractionDigits = fractionDigitsFor(currency)
  const major = minorUnits / 10 ** fractionDigits
  const key = `${locale}:${currency}`
  let formatter = moneyFormatterCache.get(key)
  if (!formatter) {
    formatter = Intl.NumberFormat(locale, { style: 'currency', currency })
    moneyFormatterCache.set(key, formatter)
  }
  return formatter.format(major)
}

export function formatNumber(value: number, locale = 'en-US'): string {
  if (locale === 'en-US') return DEFAULT_NUMBER_FORMATTER.format(value)
  let formatter = numberFormatterCache.get(locale)
  if (!formatter) {
    formatter = Intl.NumberFormat(locale)
    numberFormatterCache.set(locale, formatter)
  }
  return formatter.format(value)
}

export function formatPercent(ratio: number, locale = 'en-US', fractionDigits = 0): string {
  if (locale === 'en-US' && fractionDigits === 0) return DEFAULT_PERCENT_FORMATTER.format(ratio)
  const key = `${locale}:${fractionDigits}`
  let formatter = percentFormatterCache.get(key)
  if (!formatter) {
    formatter = Intl.NumberFormat(locale, {
      style: 'percent',
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    })
    percentFormatterCache.set(key, formatter)
  }
  return formatter.format(ratio)
}

export function relativeAgo(ms: number, now = Date.now()): string {
  const diff = now - ms
  const m = Math.floor(diff / 60_000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

const tzDateFormatterCache = new Map<string, Intl.DateTimeFormat>()

export function formatLocalDateTime(iso: string): string {
  return DEFAULT_LOCAL_DATE_TIME_FORMATTER.format(new Date(iso))
}

export function formatInTimezone(iso: string, timeZone: string): string {
  let fmt = tzDateFormatterCache.get(timeZone)
  if (!fmt) {
    fmt = Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
    tzDateFormatterCache.set(timeZone, fmt)
  }
  return fmt.format(new Date(iso))
}

export function relativeIn(ms: number, now = Date.now()): string {
  const diff = ms - now
  if (diff <= 0) return 'now'
  if (diff < 60_000) return 'in <1m'
  const m = Math.round(diff / 60_000)
  if (m < 60) return `in ${m}m`
  const h = Math.round(m / 60)
  if (h < 24) return `in ${h}h`
  return `in ${Math.round(h / 24)}d`
}
