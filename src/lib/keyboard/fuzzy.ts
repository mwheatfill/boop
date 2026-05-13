// Lightweight fuzzy scorer for the command palette. Returns a number in
// [0, 1] where 0 = no match and higher = better. Ordering follows Linear's
// pattern: exact > prefix > acronym > substring > scattered.

const PREFIX_SCORE = 0.9
const ACRONYM_SCORE = 0.7
const SUBSTRING_SCORE = 0.5
const SCATTERED_SCORE = 0.25
const KEYWORD_BONUS = 0.05

export function fuzzyScore(value: string, search: string, keywords: string[] = []): number {
  if (!search) return 1
  const v = value.toLowerCase()
  const s = search.toLowerCase().trim()
  if (!s) return 1
  if (v === s) return 1
  if (v.startsWith(s)) return PREFIX_SCORE

  // Acronym: split on spaces / hyphens / non-alphanumerics
  const initials = v
    .split(/[^a-z0-9]+/)
    .flatMap((w) => (w[0] ? [w[0]] : []))
    .join('')
  if (initials.startsWith(s)) return ACRONYM_SCORE

  if (v.includes(s)) return SUBSTRING_SCORE

  // Keyword fallback
  for (const k of keywords) {
    const kw = k.toLowerCase()
    if (kw === s) return PREFIX_SCORE + KEYWORD_BONUS
    if (kw.startsWith(s)) return SUBSTRING_SCORE + KEYWORD_BONUS
    if (kw.includes(s)) return SCATTERED_SCORE + KEYWORD_BONUS
  }

  // Scattered: every char in s appears in v in order
  let vi = 0
  let si = 0
  while (vi < v.length && si < s.length) {
    if (v[vi] === s[si]) si++
    vi++
  }
  return si === s.length ? SCATTERED_SCORE : 0
}
