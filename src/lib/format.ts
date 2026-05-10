// Number / currency formatting via the Intl built-ins. Workers ships
// the ICU dataset, so `Intl.NumberFormat` works for the vast majority
// of locales. Caveat: ~9 of 200+ locales silently fall back to en-US
// (Burmese, Khmer, Lao, Sinhala, Maltese, Welsh, Basque, Irish,
// Icelandic). Reach for FormatJS as a polyfill if you target those.
//
// Money convention: store amounts as integer minor units (cents) in
// the database. Convert to the major unit only at format time. This
// avoids float-math bugs (0.1 + 0.2 !== 0.3, 1.005 * 100 !== 100.5)
// at every layer except the very last one. Reach for dinero.js v2
// only when an app hits allocation ("split $0.05 three ways"),
// multi-currency arithmetic, or non-decimal currencies.

const ZERO_DECIMAL_CURRENCIES = new Set(['JPY', 'KRW', 'VND', 'CLP', 'ISK', 'UGX'])

function fractionDigitsFor(currency: string): number {
  return ZERO_DECIMAL_CURRENCIES.has(currency.toUpperCase()) ? 0 : 2
}

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
