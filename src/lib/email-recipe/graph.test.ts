import { describe, expect, it } from 'vitest'
import { type GraphMailConfig, graphConfigFromEnv, sendViaGraph } from './graph'
import type { MailerMessage } from './index'

const config: GraphMailConfig = {
  tenantId: 'tenant-1',
  clientId: 'client-1',
  clientSecret: 'secret-1',
  sender: 'alerts@stelglobal.com',
}

const message: MailerMessage = {
  to: ['a@example.com', 'b@example.com'],
  subject: 'Run failed',
  html: '<p>boom</p>',
  text: 'boom',
}

function ok(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status })
}

// Returns a fetch stub that yields the given responses in order and records calls.
function stub(responses: Response[]) {
  const calls: Array<{ url: string; init: RequestInit | undefined }> = []
  let i = 0
  const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init })
    const res = responses[i] ?? new Response(null, { status: 500 })
    i += 1
    return res
  }) as unknown as typeof fetch
  return { fetchImpl, calls }
}

describe('graphConfigFromEnv', () => {
  it('returns config when all fields are present', () => {
    expect(
      graphConfigFromEnv({
        GRAPH_TENANT_ID: 't',
        GRAPH_CLIENT_ID: 'c',
        GRAPH_CLIENT_SECRET: 's',
        GRAPH_MAIL_SENDER: 'm@x.com',
      }),
    ).toEqual({ tenantId: 't', clientId: 'c', clientSecret: 's', sender: 'm@x.com' })
  })

  it('returns null when any field is missing or blank', () => {
    expect(graphConfigFromEnv({})).toBeNull()
    expect(
      graphConfigFromEnv({
        GRAPH_TENANT_ID: 't',
        GRAPH_CLIENT_ID: 'c',
        GRAPH_CLIENT_SECRET: '   ',
        GRAPH_MAIL_SENDER: 'm@x.com',
      }),
    ).toBeNull()
  })
})

describe('sendViaGraph', () => {
  it('gets a token then sends, returning ok on 202', async () => {
    const { fetchImpl, calls } = stub([
      ok({ access_token: 'tok' }),
      new Response(null, { status: 202 }),
    ])
    const result = await sendViaGraph(config, message, fetchImpl)
    expect(result).toEqual({ ok: true })
    expect(calls[0]?.url).toBe('https://login.microsoftonline.com/tenant-1/oauth2/v2.0/token')
    expect(calls[1]?.url).toBe(
      'https://graph.microsoft.com/v1.0/users/alerts%40stelglobal.com/sendMail',
    )
    const body = JSON.parse(calls[1]?.init?.body as string)
    expect(body.message.toRecipients).toEqual([
      { emailAddress: { address: 'a@example.com' } },
      { emailAddress: { address: 'b@example.com' } },
    ])
    expect(body.message.body).toEqual({ contentType: 'HTML', content: '<p>boom</p>' })
  })

  it('marks a 5xx sendMail as retryable', async () => {
    const { fetchImpl } = stub([ok({ access_token: 'tok' }), new Response('busy', { status: 503 })])
    const result = await sendViaGraph(config, message, fetchImpl)
    expect(result).toMatchObject({ ok: false, retryable: true })
  })

  it('marks a 403 sendMail as not retryable (permission/config)', async () => {
    const { fetchImpl } = stub([
      ok({ access_token: 'tok' }),
      new Response('denied', { status: 403 }),
    ])
    const result = await sendViaGraph(config, message, fetchImpl)
    expect(result).toMatchObject({ ok: false, retryable: false })
  })

  it('fails without sending when the token request is rejected', async () => {
    const { fetchImpl, calls } = stub([new Response('bad creds', { status: 401 })])
    const result = await sendViaGraph(config, message, fetchImpl)
    expect(result).toMatchObject({ ok: false, retryable: false })
    expect(calls).toHaveLength(1)
  })
})
