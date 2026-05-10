// Structured logging wrapper. Workers Logs auto-indexes the JSON object
// passed as `console.*`'s argument, so a thin shape-enforcing wrapper
// gives us all the queryability of a real logger without the dep weight
// of one. Recipes (monitoring/sentry, monitoring/otel-export, etc.)
// overlay this module to add `Sentry.captureException`, OTel spans, etc.,
// without touching call sites.
//
// Convention: the first arg is a dotted event name (`domain.action.outcome`);
// the second is structured fields. Errors are passed as a separate arg so
// normalization happens in one place.

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
