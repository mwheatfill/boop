import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AlertContext } from '@/shared/schemas/alert-context'
import type { TeamsConfig } from '@/shared/schemas/channel'
import { buildTeamsCard, deliverTeams } from './teams'

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
  rule_name: 'On first failure',
  rule_kind: 'first_failure',
  test: false,
}

function teamsConfig(overrides: Partial<TeamsConfig> = {}): TeamsConfig {
  return { kind: 'teams', webhook_url: 'https://teams.example.com/hook', ...overrides }
}

let fetchSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  fetchSpy = vi.spyOn(globalThis, 'fetch')
})
afterEach(() => fetchSpy.mockRestore())

describe('buildTeamsCard', () => {
  it('renders Adaptive Card envelope with run url action', () => {
    const card = buildTeamsCard(baseContext) as Record<string, unknown>
    const [attachment] = card.attachments as Array<{ content: { actions: unknown[] } }>
    expect(attachment).toBeDefined()
    expect(attachment?.content.actions).toEqual([
      { type: 'Action.OpenUrl', title: 'Open Run', url: baseContext.run_url },
    ])
  })

  it('renders missed schedule cards with a Job url action', () => {
    const card = buildTeamsCard({
      kind: 'missed',
      workspace_name: 'Acme',
      workspace_slug: 'acme',
      job_name: 'Daily',
      job_slug: 'daily',
      job_url: 'https://boop/workspaces/acme/jobs/daily',
      rule_name: 'Silence alert',
      rule_kind: 'missed_schedule',
      last_run_at: '2026-05-10T00:00:00.000Z',
      silence_threshold_minutes: 60,
      trigger_source: 'cron',
      schedule: '0 9 * * *',
      test: false,
    }) as Record<string, unknown>
    const [attachment] = card.attachments as Array<{ content: { actions: unknown[] } }>
    expect(attachment?.content.actions).toEqual([
      {
        type: 'Action.OpenUrl',
        title: 'Open Job',
        url: 'https://boop/workspaces/acme/jobs/daily',
      },
    ])
  })
})

describe('deliverTeams', () => {
  it('returns ok on 2xx', async () => {
    fetchSpy.mockResolvedValue(new Response(null, { status: 200 }))
    const result = await deliverTeams(teamsConfig(), baseContext)
    expect(result).toEqual({ ok: true })
  })
  it('returns retryable on 5xx', async () => {
    fetchSpy.mockResolvedValue(new Response(null, { status: 503 }))
    const result = await deliverTeams(teamsConfig(), baseContext)
    expect(result).toEqual({ ok: false, retryable: true, reason: 'HTTP 503' })
  })
  it('returns non-retryable on 4xx', async () => {
    fetchSpy.mockResolvedValue(new Response(null, { status: 400 }))
    const result = await deliverTeams(teamsConfig(), baseContext)
    expect(result).toEqual({ ok: false, retryable: false, reason: 'HTTP 400' })
  })
  it('returns retryable on network error', async () => {
    fetchSpy.mockRejectedValue(new Error('boom'))
    const result = await deliverTeams(teamsConfig(), baseContext)
    expect(result).toEqual({ ok: false, retryable: true, reason: 'boom' })
  })
})
