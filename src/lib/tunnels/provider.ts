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

// The raw runtime env vars that carry the provider config. Optional so both the
// Worker `env` (vars typed as `string`) and the heartbeat's `ScheduledEnv` (typed
// `string | undefined`) satisfy it; empty values fail the check in getProviderConfig.
export interface ProviderEnvVars {
  CF_PROVIDER_API_TOKEN?: string
  CF_PROVIDER_ACCOUNT_ID?: string
  CF_PROVIDER_ZONE_ID?: string
  CF_TUNNEL_HOSTNAME_BASE?: string
}

// One place that reads the four provider env vars into a ProviderConfig. Every
// tunnel entrypoint (Target reconcile, tunnel server-fns, the heartbeat) resolves
// the provider through here so the var-to-config mapping lives in a single seam.
export function providerConfigFromEnv(env: ProviderEnvVars): ProviderConfig {
  return getProviderConfig({
    apiToken: env.CF_PROVIDER_API_TOKEN ?? '',
    accountId: env.CF_PROVIDER_ACCOUNT_ID ?? '',
    zoneId: env.CF_PROVIDER_ZONE_ID ?? '',
    hostnameBase: env.CF_TUNNEL_HOSTNAME_BASE ?? '',
  })
}
