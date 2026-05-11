// First arg is a dotted event name (`domain.action.outcome`); the
// monitoring recipes overlay this module to add Sentry / App Insights /
// OTel without touching call sites.

type LogFields = Record<string, unknown>

function normalizeError(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

export function logInfo(event: string, fields?: LogFields): void {
  console.log(event, fields ?? {})
}

export function logWarn(event: string, fields?: LogFields): void {
  console.warn(event, fields ?? {})
}

export function logError(event: string, error?: unknown, fields?: LogFields): void {
  console.error(event, {
    ...fields,
    ...(error !== undefined && { error: normalizeError(error) }),
  })
}
