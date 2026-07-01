import type { AlertContext } from '@/shared/schemas/alert-context'

export type AdapterResult = { ok: true } | { ok: false; retryable: boolean; reason: string }

export type AdapterFn<TConfig> = (config: TConfig, ctx: AlertContext) => Promise<AdapterResult>

export function classifyHttpResult(status: number): AdapterResult {
  if (status >= 200 && status < 300) return { ok: true }
  if (status >= 500 && status < 600) {
    return { ok: false, retryable: true, reason: `HTTP ${status}` }
  }
  return { ok: false, retryable: false, reason: `HTTP ${status}` }
}

export function networkFailure(err: unknown): AdapterResult {
  const reason = err instanceof Error ? err.message : 'network error'
  return { ok: false, retryable: true, reason }
}
