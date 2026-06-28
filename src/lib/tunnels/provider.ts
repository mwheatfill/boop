import { type CloudflareApi, createCloudflareApi } from '@/lib/cloudflare-api/client'

export class TunnelProvisioningNotConfiguredError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TunnelProvisioningNotConfiguredError'
  }
}

export interface ProviderConfig {
  cf: CloudflareApi
  zoneId: string
  hostnameBase: string
}

// Provider-owned (Model B) Cloudflare config: a single API token (a Worker
// secret) plus the account id, DNS zone, and wildcard hostname base (vars).
export interface ProviderEnv {
  apiToken: string
  accountId: string
  zoneId: string
  hostnameBase: string
}

export function getProviderConfig(env: ProviderEnv): ProviderConfig {
  const { apiToken, accountId, zoneId, hostnameBase } = env
  if (!apiToken || !accountId || !zoneId || !hostnameBase) {
    throw new TunnelProvisioningNotConfiguredError(
      'Set CF_PROVIDER_API_TOKEN, CF_PROVIDER_ACCOUNT_ID, CF_PROVIDER_ZONE_ID, and CF_TUNNEL_HOSTNAME_BASE.',
    )
  }
  return { cf: createCloudflareApi({ accountId, apiToken }), zoneId, hostnameBase }
}
