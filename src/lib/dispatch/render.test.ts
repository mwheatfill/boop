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

  describe('{% boop_secret %} tag', () => {
    it('calls the resolver with the literal key name and emits the plaintext', async () => {
      const calls: string[] = []
      const resolver = async (name: string) => {
        calls.push(name)
        return 'sk_live_42'
      }
      const out = await renderTemplate('Authorization: Bearer {% boop_secret "stripe" %}', {
        ...ctx(),
        secretResolver: resolver,
      })
      expect(out).toBe('Authorization: Bearer sk_live_42')
      expect(calls).toEqual(['stripe'])
    })

    it('redacts to <<secret:name>> in preview mode without calling the resolver', async () => {
      let resolverCalled = false
      const resolver = async () => {
        resolverCalled = true
        return 'should-not-appear'
      }
      const out = await renderTemplate('{% boop_secret "stripe" %}', {
        ...ctx(),
        previewMode: true,
        secretResolver: resolver,
      })
      expect(out).toBe('<<secret:stripe>>')
      expect(resolverCalled).toBe(false)
    })

    it('throws when no resolver is supplied in fire mode', async () => {
      await expect(renderTemplate('{% boop_secret "k" %}', ctx())).rejects.toThrow(
        /no secret resolver was provided/,
      )
    })

    it('propagates resolver errors so the dispatcher can mark the Run failed', async () => {
      const resolver = async () => {
        throw new Error('Secret not found: missing')
      }
      await expect(
        renderTemplate('{% boop_secret "missing" %}', { ...ctx(), secretResolver: resolver }),
      ).rejects.toThrow(/Secret not found: missing/)
    })
  })
})
