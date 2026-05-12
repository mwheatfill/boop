import { describe, expect, it } from 'vitest'
import { renderTemplate } from './render'

const fixedNow = new Date('2026-05-12T14:30:00.000Z')

function ctx(overrides: Partial<Parameters<typeof renderTemplate>[1]> = {}) {
  return {
    runId: 'run_abc',
    attemptNumber: 1,
    customerName: 'Acme',
    customerTimezone: 'UTC',
    now: fixedNow,
    ...overrides,
  }
}

describe('renderTemplate', () => {
  it('renders {{ now | iso_date }} as a UTC ISO 8601 string', async () => {
    const out = await renderTemplate('{{ now | iso_date }}', ctx())
    expect(out).toBe('2026-05-12T14:30:00.000Z')
  })

  it('renders {{ now | tz | iso_date }} in the supplied IANA zone', async () => {
    const out = await renderTemplate(
      '{{ now | tz: "America/New_York" | iso_date }}',
      ctx({ customerTimezone: 'America/New_York' }),
    )
    expect(out).toBe('2026-05-12T10:30:00')
  })

  it('exposes context variables to templates', async () => {
    const out = await renderTemplate('{{ run_id }}/{{ attempt_number }}/{{ customer_name }}', ctx())
    expect(out).toBe('run_abc/1/Acme')
  })

  it('merges operator variables into the render scope', async () => {
    const out = await renderTemplate('{{ tenant }}', ctx({ variables: { tenant: 'switchthink' } }))
    expect(out).toBe('switchthink')
  })

  it('throws on an unknown filter (strict filters)', async () => {
    await expect(renderTemplate('{{ now | nonsense }}', ctx())).rejects.toThrow()
  })

  it('does not leak globalThis into the sandbox', async () => {
    const out = await renderTemplate('{{ globalThis }}', ctx())
    expect(out).toBe('')
  })

  it('throws "not yet implemented" for the boop_secret tag', async () => {
    await expect(renderTemplate('{% boop_secret "key" %}', ctx())).rejects.toThrow(
      /not yet implemented/,
    )
  })
})
