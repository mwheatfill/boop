import { describe, expect, it } from 'vitest'
import { type DirectoryConfig, directoryConfigFromEnv, searchDirectory } from './graph-directory'

const config: DirectoryConfig = {
  tenantId: 'tenant-1',
  clientId: 'client-1',
  clientSecret: 'secret-1',
}

function ok(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status })
}

// A fetch stub that yields the given responses in order and records the calls.
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

// Fresh each call: a Response body can only be read once, so reusing one
// instance across tests would starve later token reads.
function token(): Response {
  return ok({ access_token: 'tok' })
}

describe('directoryConfigFromEnv', () => {
  it('returns config when all fields are present', () => {
    expect(
      directoryConfigFromEnv({
        GRAPH_TENANT_ID: 't',
        GRAPH_DIR_CLIENT_ID: 'c',
        GRAPH_DIR_CLIENT_SECRET: 's',
      }),
    ).toEqual({ tenantId: 't', clientId: 'c', clientSecret: 's' })
  })

  it('returns null when any field is missing or blank', () => {
    expect(directoryConfigFromEnv({})).toBeNull()
    expect(
      directoryConfigFromEnv({
        GRAPH_TENANT_ID: 't',
        GRAPH_DIR_CLIENT_ID: '   ',
        GRAPH_DIR_CLIENT_SECRET: 's',
      }),
    ).toBeNull()
  })
})

describe('searchDirectory', () => {
  it('returns [] for an empty query without hitting the network', async () => {
    const { fetchImpl, calls } = stub([])
    expect(await searchDirectory(config, '   ', fetchImpl)).toEqual([])
    expect(calls).toHaveLength(0)
  })

  it('maps users then groups, dropping entries without a mail', async () => {
    const { fetchImpl, calls } = stub([
      token(),
      ok({
        value: [
          { id: 'u1', displayName: 'Dana Ops', mail: 'dana@x.com' },
          { id: 'u2', displayName: 'No Mail', mail: null },
          { id: 'u3', displayName: '  ', mail: 'blank-name@x.com' },
        ],
      }),
      ok({
        value: [
          { id: 'g1', displayName: 'Ops Team', mail: 'ops@x.com' },
          { id: 'g2', displayName: 'Secret Group' },
        ],
      }),
    ])

    const result = await searchDirectory(config, 'ops', fetchImpl)

    expect(result).toEqual([
      { id: 'u1', displayName: 'Dana Ops', mail: 'dana@x.com', type: 'user' },
      { id: 'u3', displayName: 'blank-name@x.com', mail: 'blank-name@x.com', type: 'user' },
      { id: 'g1', displayName: 'Ops Team', mail: 'ops@x.com', type: 'group' },
    ])
    expect(calls[0]?.url).toBe('https://login.microsoftonline.com/tenant-1/oauth2/v2.0/token')
    expect(calls[1]?.url).toContain('/users?$search=')
    expect(calls[2]?.url).toContain('mailEnabled%20eq%20true')
    expect((calls[1]?.init?.headers as Record<string, string>).ConsistencyLevel).toBe('eventual')
  })

  it('returns [] when the token request fails', async () => {
    const { fetchImpl, calls } = stub([new Response('bad creds', { status: 401 })])
    expect(await searchDirectory(config, 'ops', fetchImpl)).toEqual([])
    expect(calls).toHaveLength(1)
  })

  it('degrades to the other kind when one listing errors', async () => {
    const { fetchImpl } = stub([
      token(),
      new Response('boom', { status: 500 }),
      ok({ value: [{ id: 'g1', displayName: 'Ops Team', mail: 'ops@x.com' }] }),
    ])
    expect(await searchDirectory(config, 'ops', fetchImpl)).toEqual([
      { id: 'g1', displayName: 'Ops Team', mail: 'ops@x.com', type: 'group' },
    ])
  })

  it('returns [] when a thrown fetch error escapes', async () => {
    const fetchImpl = (async () => {
      throw new Error('network down')
    }) as unknown as typeof fetch
    expect(await searchDirectory(config, 'ops', fetchImpl)).toEqual([])
  })
})
