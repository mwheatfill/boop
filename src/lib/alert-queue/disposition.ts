import type { AdapterResult } from '@/lib/channel-adapters/types'

const RETRY_BASE_SECONDS = 60
const MAX_DELIVERY_ATTEMPTS = 5

export type Disposition = { ack: true } | { retry: true; delaySeconds: number }

export function retryDelaySeconds(attempts: number): number {
  return 2 ** Math.min(attempts, 6) * RETRY_BASE_SECONDS
}

// Pure over (adapterResult, attempts): decides ack vs retry-with-backoff. Delivery
// succeeds -> ack; a retryable failure under the attempt gate -> retry with exponential
// backoff; anything else (non-retryable, or the gate is spent) -> ack (give up).
export function decideDisposition(result: AdapterResult, attempts: number): Disposition {
  if (result.ok) return { ack: true }
  if (result.retryable && attempts < MAX_DELIVERY_ATTEMPTS) {
    return { retry: true, delaySeconds: retryDelaySeconds(attempts) }
  }
  return { ack: true }
}
