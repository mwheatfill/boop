const ZERO_DECIMAL_CURRENCIES = new Set(['JPY', 'KRW', 'VND', 'CLP', 'ISK', 'UGX'])

function fractionDigitsFor(currency: string): number {
  return ZERO_DECIMAL_CURRENCIES.has(currency.toUpperCase()) ? 0 : 2
}

// Pass `minorUnits` as integer cents (or whole units for zero-decimal
// currencies). Storing money as floats invites 0.1 + 0.2 !== 0.3.
export function formatMoney(minorUnits: number, currency: string, locale = 'en-US'): string {
  const fractionDigits = fractionDigitsFor(currency)
  const major = minorUnits / 10 ** fractionDigits
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(major)
}

export function formatNumber(value: number, locale = 'en-US'): string {
  return new Intl.NumberFormat(locale).format(value)
}

export function formatPercent(ratio: number, locale = 'en-US', fractionDigits = 0): string {
  return new Intl.NumberFormat(locale, {
    style: 'percent',
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(ratio)
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

export function relativeIn(ms: number, now = Date.now()): string {
  const diff = ms - now
  if (diff <= 0) return 'now'
  const m = Math.floor(diff / 60_000)
  if (m < 60) return `in ${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `in ${h}h`
  return `in ${Math.floor(h / 24)}d`
}
