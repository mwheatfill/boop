const DEFAULT_SENSITIVE_KEYS = [
  'authorization',
  'cookie',
  'set-cookie',
  'x-api-key',
  'proxy-authorization',
  'cf-access-client-id',
  'cf-access-client-secret',
] as const

const REDACTED = '[redacted]'

interface RedactOptions {
  additionalKeys?: readonly string[]
}

export function redactHeaders(
  headers: Record<string, unknown>,
  options: RedactOptions = {},
): Record<string, string> {
  const sensitive = new Set(
    [...DEFAULT_SENSITIVE_KEYS, ...(options.additionalKeys ?? [])].map((k) => k.toLowerCase()),
  )
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(headers)) {
    out[key] = sensitive.has(key.toLowerCase()) ? REDACTED : String(value)
  }
  return out
}
