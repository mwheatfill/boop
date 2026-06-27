import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AlertContext } from '@/shared/schemas/alert-context'
import type { Channel } from '@/shared/schemas/channel'
import { deliverWebhook } from './webhook'

const baseContext: AlertContext = {
  kind: 'run',
  workspace_name: 'Acme',
  workspace_slug: 'acme',
  job_name: 'Daily',
  job_slug: 'daily',
  target_name: 'API',
  target_url: 'https://api.example.com',
  run_id: 'run_1',
  run_url: 'https://boop/workspaces/acme/jobs/daily/runs/run_1',
  outcome: 'failure',
  started_at: '2026-05-12T00:00:00Z',
  completed_at: '2026-05-12T00:00:03Z',
  duration_ms: 3000,
  attempt_count: 2,
  trigger_source: 'cron',
  failure_kind: 'http_5xx',
  rule_name: 'r',
  rule_kind: 'first_failure',
  test: false,
}

function webhookChannel(overrides: Partial<Channel['config']> = {}): Channel {
  return {
    id: 'chn_w',
    workspaceId: 'wsp_1',
    kind: 'webhook',
    name: 'Status webhook',
    slug: 'status-webhook',
    config: {
      kind: 'webhook',
      url: 'https://example.com/hook',
      method: 'POST',
      headers: { 'x-app': 'boop' },
      body_template: '{{ alert_context_json }}',
      ...overrides,
    } as Channel['config'],
    status: 'active',
    lastUsedAt: null,
    lastTestAlertAt: null,
    lastTestAlertStatus: null,
    lastTestAlertReason: null,
    createdAt: '2026-05-12T00:00:00Z',
    updatedAt: '2026-05-12T00:00:00Z',
  }
}

let fetchSpy: ReturnType<typeof vi.spyOn>
beforeEach(() => {
  fetchSpy = vi.spyOn(globalThis, 'fetch')
})
afterEach(() => fetchSpy.mockRestore())

describe('deliverWebhook', () => {
  it('renders body template + custom headers and POSTs to url', async () => {
    fetchSpy.mockResolvedValue(new Response(null, { status: 200 }))
    await deliverWebhook({ channel: webhookChannel(), alertContext: baseContext })
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://example.com/hook')
    expect(init.method).toBe('POST')
    const headers = init.headers as Record<string, string>
    expect(headers['x-app']).toBe('boop')
    expect(headers['content-type']).toBe('application/json')
    expect(JSON.parse(init.body as string)).toMatchObject({ run_id: 'run_1' })
  })

  it('2xx → ok; 5xx → retryable; 4xx → non-retryable', async () => {
    for (const { status, expected } of [
      { status: 200, expected: { ok: true } as const },
      { status: 503, expected: { ok: false, retryable: true, reason: 'HTTP 503' } as const },
      { status: 400, expected: { ok: false, retryable: false, reason: 'HTTP 400' } as const },
    ]) {
      fetchSpy.mockResolvedValueOnce(new Response(null, { status }))
      const result = await deliverWebhook({
        channel: webhookChannel(),
        alertContext: baseContext,
      })
      expect(result).toEqual(expected)
    }
  })
})
