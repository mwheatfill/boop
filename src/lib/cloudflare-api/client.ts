import { logWarn } from '@/lib/log'
import { CloudflareApiError, type CloudflareApiErrorDetail } from './errors'

const API_BASE = 'https://api.cloudflare.com/client/v4'
const MAX_RETRIES = 3

const CONNECTOR_STATUSES = ['healthy', 'degraded', 'down', 'inactive'] as const
export type ConnectorStatus = (typeof CONNECTOR_STATUSES)[number]

export interface CloudflareApiOptions {
  accountId: string
  apiToken: string
  // Injectable for tests; defaults to global fetch.
  fetchImpl?: typeof fetch
  // Injectable for tests so 429 backoff doesn't sleep for real.
  sleep?: (ms: number) => Promise<void>
}

interface CfEnvelope<T> {
  success: boolean
  errors: CloudflareApiErrorDetail[]
  result: T
}

const CONNECTOR_STATUS_SET: ReadonlySet<string> = new Set(CONNECTOR_STATUSES)

function normalizeConnectorStatus(raw: unknown): ConnectorStatus {
  return typeof raw === 'string' && CONNECTOR_STATUS_SET.has(raw)
    ? (raw as ConnectorStatus)
    : 'inactive'
}

export type CertStatus = 'active' | 'pending' | 'error'

// Cloudflare cert-pack statuses collapse to three boop cares about: live, still
// issuing, or stuck. Unknowns are treated as pending (transient by default).
function normalizeCertStatus(raw: unknown): CertStatus {
  if (raw === 'active') return 'active'
  if (
    typeof raw === 'string' &&
    (raw === 'expired' || raw === 'deleted' || raw.endsWith('_timed_out'))
  ) {
    return 'error'
  }
  return 'pending'
}

export interface CloudflareApi {
  createTunnel(name: string): Promise<{ id: string }>
  getTunnelToken(tunnelId: string): Promise<string>
  putTunnelIngress(
    tunnelId: string,
    routes: Array<{ hostname: string; service: string }>,
  ): Promise<void>
  getTunnelStatus(tunnelId: string): Promise<ConnectorStatus>
  deleteTunnel(tunnelId: string): Promise<void>
  createServiceToken(name: string): Promise<{ id: string; clientId: string; clientSecret: string }>
  deleteServiceToken(tokenId: string): Promise<void>
  createAccessPolicy(name: string, serviceTokenId: string): Promise<{ id: string }>
  deleteAccessPolicy(policyId: string): Promise<void>
  createAccessApp(name: string, domain: string, policyIds: string[]): Promise<{ id: string }>
  deleteAccessApp(appId: string): Promise<void>
  createDnsRecord(zoneId: string, name: string, content: string): Promise<{ id: string }>
  deleteDnsRecord(zoneId: string, recordId: string): Promise<void>
  orderCertPack(zoneId: string, hosts: string[]): Promise<{ id: string }>
  getCertStatus(zoneId: string, certPackId: string): Promise<CertStatus>
  deleteCertPack(zoneId: string, certPackId: string): Promise<void>
}

export function createCloudflareApi(options: CloudflareApiOptions): CloudflareApi {
  const { accountId, apiToken } = options
  const fetchImpl = options.fetchImpl ?? fetch
  const sleep = options.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)))

  async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const op = `${method} ${path}`
    const init: RequestInit = {
      method,
      headers: {
        authorization: `Bearer ${apiToken}`,
        'content-type': 'application/json',
      },
    }
    if (body !== undefined) {
      init.body = JSON.stringify(body)
    }
    for (let attempt = 0; ; attempt++) {
      let res: Response
      try {
        res = await fetchImpl(`${API_BASE}${path}`, init)
      } catch (err) {
        if (attempt < MAX_RETRIES) {
          logWarn('cloudflare_api.retrying', { op, attempt, reason: 'network' })
          await sleep(2 ** attempt * 1000)
          continue
        }
        const message = err instanceof Error ? err.message : 'network error'
        throw new CloudflareApiError(0, op, [{ code: 0, message }])
      }

      if (res.status === 429 && attempt < MAX_RETRIES) {
        const retryAfter = Number(res.headers.get('retry-after'))
        const waitMs =
          Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 2 ** attempt * 1000
        logWarn('cloudflare_api.retrying', { op, attempt, reason: 'rate_limited', waitMs })
        await sleep(waitMs)
        continue
      }

      // A 2xx with an empty/non-JSON body (e.g. 204 from DELETE) yields null;
      // that is success, so only an explicit success:false or non-2xx throws.
      const json = (await res.json().catch(() => null)) as CfEnvelope<T> | null
      if (!res.ok || json?.success === false) {
        throw new CloudflareApiError(res.status, op, json?.errors ?? [])
      }
      return json?.result as T
    }
  }

  const account = (suffix: string) => `/accounts/${accountId}${suffix}`

  return {
    async createTunnel(name) {
      const result = await request<{ id: string }>('POST', account('/cfd_tunnel'), {
        name,
        config_src: 'cloudflare',
      })
      return { id: result.id }
    },

    async getTunnelToken(tunnelId) {
      // This endpoint's `result` is the raw connector token string.
      return request<string>('GET', account(`/cfd_tunnel/${tunnelId}/token`))
    },

    async putTunnelIngress(tunnelId, routes) {
      await request('PUT', account(`/cfd_tunnel/${tunnelId}/configurations`), {
        config: {
          ingress: [
            ...routes.map((r) => ({ hostname: r.hostname, service: r.service })),
            { service: 'http_status:404' },
          ],
        },
      })
    },

    async getTunnelStatus(tunnelId) {
      const result = await request<{ status?: string }>('GET', account(`/cfd_tunnel/${tunnelId}`))
      return normalizeConnectorStatus(result.status)
    },

    async deleteTunnel(tunnelId) {
      await request('DELETE', account(`/cfd_tunnel/${tunnelId}`))
    },

    async createServiceToken(name) {
      const result = await request<{ id: string; client_id: string; client_secret: string }>(
        'POST',
        account('/access/service_tokens'),
        { name },
      )
      return { id: result.id, clientId: result.client_id, clientSecret: result.client_secret }
    },

    async deleteServiceToken(tokenId) {
      await request('DELETE', account(`/access/service_tokens/${tokenId}`))
    },

    async createAccessPolicy(name, serviceTokenId) {
      const result = await request<{ id: string }>('POST', account('/access/policies'), {
        name,
        decision: 'non_identity',
        include: [{ service_token: { token_id: serviceTokenId } }],
      })
      return { id: result.id }
    },

    async deleteAccessPolicy(policyId) {
      await request('DELETE', account(`/access/policies/${policyId}`))
    },

    async createAccessApp(name, domain, policyIds) {
      const result = await request<{ id: string }>('POST', account('/access/apps'), {
        name,
        type: 'self_hosted',
        domain,
        policies: policyIds,
      })
      return { id: result.id }
    },

    async deleteAccessApp(appId) {
      await request('DELETE', account(`/access/apps/${appId}`))
    },

    async createDnsRecord(zoneId, name, content) {
      const result = await request<{ id: string }>('POST', `/zones/${zoneId}/dns_records`, {
        type: 'CNAME',
        name,
        content,
        proxied: true,
      })
      return { id: result.id }
    },

    async deleteDnsRecord(zoneId, recordId) {
      await request('DELETE', `/zones/${zoneId}/dns_records/${recordId}`)
    },

    async orderCertPack(zoneId, hosts) {
      const result = await request<{ id: string }>(
        'POST',
        `/zones/${zoneId}/ssl/certificate_packs/order`,
        {
          type: 'advanced',
          hosts,
          validation_method: 'txt',
          validity_days: 90,
          certificate_authority: 'google',
        },
      )
      return { id: result.id }
    },

    async getCertStatus(zoneId, certPackId) {
      const result = await request<{ status?: string }>(
        'GET',
        `/zones/${zoneId}/ssl/certificate_packs/${certPackId}`,
      )
      return normalizeCertStatus(result.status)
    },

    async deleteCertPack(zoneId, certPackId) {
      await request('DELETE', `/zones/${zoneId}/ssl/certificate_packs/${certPackId}`)
    },
  }
}
