// English-only default import keeps the locale bundle out of the client;
// `cronstrue/i18n` would pull every locale. See ADR-020 for the current pin.
import cronstrue from 'cronstrue'

// Humanize a 5-field cron expression the way the operator will read it in the
// preview. Derived from the persisted expression so the description can never
// disagree with what actually runs. Returns null when the expression does not
// parse, so callers fall back to a neutral label.
export function describeCron(expression: string): string | null {
  try {
    return cronstrue.toString(expression, { verbose: false })
  } catch {
    return null
  }
}
