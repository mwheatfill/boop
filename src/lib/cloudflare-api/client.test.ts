import { describe, expect, it, vi } from 'vitest'
import { createCloudflareApi } from './client'

interface Captured {
  url: string
  method: string
  headers: Record<string, string>
  body: unknown
}

function ok(result: unknown): Response {
  return new Response(JSON.stringify({ success: true, errors: [], result }), { status: 200 })
}

function fail(status: number, errors: { code: number; message: string }[]): Response {
  return new Response(JSON.stringify({ success: false, errors, result: null }), { status })
}

function harness(responses: Response[]) {
  const calls: Captured[] = []
  let i = 0
  const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({
      url: String(url),
      method: init?.method ?? 'GET',
      headers: (init?.headers ?? {}) as Record<string, string>,
      body: init?.body ? JSON.parse(init.body as string) : undefined,
    })
    const res = responses[i] ?? ok({})
    i += 1
    return res
  }) as unknown as typeof fetch
  const api = createCloudflareApi({
    accountId: 'acct1',
    apiToken: 'tok1',
    fetchImpl,
    sleep: async () => {},
  })
  function call(index = 0): Captured {
    const c = calls[index]
    if (!c) throw new Error(`no call at index ${index}`)
    return c
  }
  return { api, call }
}

describe('createCloudflareApi', () => {
  it('creates a remotely-managed tunnel', async () => {
    const { api, call } = harness([ok({ id: 'tnl_cf_1' })])
    await expect(api.createTunnel('Acme HQ')).resolves.toEqual({ id: 'tnl_cf_1' })
    expect(call()).toMatchObject({
      method: 'POST',
      url: 'https://api.cloudflare.com/client/v4/accounts/acct1/cfd_tunnel',
      body: { name: 'Acme HQ', config_src: 'cloudflare' },
      headers: { authorization: 'Bearer tok1' },
    })
  })

  it('returns the raw connector token string', async () => {
    const { api } = harness([ok('eyJhIjoabc')])
    await expect(api.getTunnelToken('tnl_cf_1')).resolves.toBe('eyJhIjoabc')
  })

  it('configures ingress with a fallback rule', async () => {
    const { api, call } = harness([ok({})])
    await api.putTunnelIngress('tnl_cf_1', [
      { hostname: 'acme.tunnels.example', service: 'http://10.0.1.5:8080' },
    ])
    expect(call()).toMatchObject({
      method: 'PUT',
      url: 'https://api.cloudflare.com/client/v4/accounts/acct1/cfd_tunnel/tnl_cf_1/configurations',
      body: {
        config: {
          ingress: [
            { hostname: 'acme.tunnels.example', service: 'http://10.0.1.5:8080' },
            { service: 'http_status:404' },
          ],
        },
      },
    })
  })

  it('normalizes a known connector status and falls back to inactive', async () => {
    const healthy = harness([ok({ status: 'healthy' })])
    await expect(healthy.api.getTunnelStatus('t')).resolves.toBe('healthy')
    const weird = harness([ok({ status: 'something-new' })])
    await expect(weird.api.getTunnelStatus('t')).resolves.toBe('inactive')
    const missing = harness([ok({})])
    await expect(missing.api.getTunnelStatus('t')).resolves.toBe('inactive')
  })

  it('maps service token snake_case to camelCase', async () => {
    const { api } = harness([ok({ id: 'st1', client_id: 'cid.access', client_secret: 'secret' })])
    await expect(api.createServiceToken('acme')).resolves.toEqual({
      id: 'st1',
      clientId: 'cid.access',
      clientSecret: 'secret',
    })
  })

  it('rotates a service token via the rotate endpoint', async () => {
    const { api, call } = harness([
      ok({ id: 'st1', client_id: 'cid.access', client_secret: 'new' }),
    ])
    await expect(api.rotateServiceToken('st1')).resolves.toEqual({
      clientId: 'cid.access',
      clientSecret: 'new',
    })
    expect(call()).toMatchObject({
      method: 'POST',
      url: 'https://api.cloudflare.com/client/v4/accounts/acct1/access/service_tokens/st1/rotate',
    })
  })

  it('creates a non_identity service-token policy', async () => {
    const { api, call } = harness([ok({ id: 'pol1' })])
    await expect(api.createAccessPolicy('acme', 'st1')).resolves.toEqual({ id: 'pol1' })
    expect(call()).toMatchObject({
      body: {
        name: 'acme',
        decision: 'non_identity',
        include: [{ service_token: { token_id: 'st1' } }],
      },
    })
  })

  it('creates a self_hosted access app bound to policies', async () => {
    const { api, call } = harness([ok({ id: 'app1' })])
    await expect(api.createAccessApp('acme', 'acme.tunnels.example', ['pol1'])).resolves.toEqual({
      id: 'app1',
    })
    expect(call()).toMatchObject({
      body: {
        name: 'acme',
        type: 'self_hosted',
        domain: 'acme.tunnels.example',
        policies: ['pol1'],
      },
    })
  })

  it('creates a proxied CNAME dns record on the zone', async () => {
    const { api, call } = harness([ok({ id: 'dns1' })])
    await api.createDnsRecord('zone1', 'acme.tunnels.example', 'uuid.cfargotunnel.com')
    expect(call()).toMatchObject({
      url: 'https://api.cloudflare.com/client/v4/zones/zone1/dns_records',
      body: {
        type: 'CNAME',
        name: 'acme.tunnels.example',
        content: 'uuid.cfargotunnel.com',
        proxied: true,
      },
    })
  })

  it('treats a 204/empty body as success so deletes do not throw', async () => {
    const { api } = harness([new Response(null, { status: 204 })])
    await expect(api.deleteTunnel('tnl_cf_1')).resolves.toBeUndefined()
  })

  it('wraps a network failure as CloudflareApiError after retries', async () => {
    const sleep = vi.fn(async () => {})
    const fetchImpl = (async () => {
      throw new TypeError('fetch failed')
    }) as unknown as typeof fetch
    const api = createCloudflareApi({ accountId: 'a', apiToken: 't', fetchImpl, sleep })
    await expect(api.createTunnel('x')).rejects.toMatchObject({
      name: 'CloudflareApiError',
      status: 0,
    })
    expect(sleep).toHaveBeenCalledTimes(3)
  })

  it('throws CloudflareApiError on success=false', async () => {
    const { api } = harness([fail(403, [{ code: 10000, message: 'Authentication error' }])])
    await expect(api.createTunnel('x')).rejects.toMatchObject({
      name: 'CloudflareApiError',
      status: 403,
      errors: [{ code: 10000, message: 'Authentication error' }],
    })
  })

  it('retries once on 429 then succeeds', async () => {
    const sleep = vi.fn(async () => {})
    let i = 0
    const responses = [
      new Response('{}', { status: 429, headers: { 'retry-after': '1' } }),
      ok({ id: 'tnl_cf_1' }),
    ]
    const fetchImpl = (async () => {
      const r = responses[i]
      i += 1
      return r
    }) as unknown as typeof fetch
    const api = createCloudflareApi({ accountId: 'a', apiToken: 't', fetchImpl, sleep })
    await expect(api.createTunnel('x')).resolves.toEqual({ id: 'tnl_cf_1' })
    expect(i).toBe(2)
    expect(sleep).toHaveBeenCalledOnce()
  })
})
