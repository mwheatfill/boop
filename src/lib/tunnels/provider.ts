import { type CloudflareApi, createCloudflareApi } from '@/lib/cloudflare-api/client'
import type { Database } from '@/lib/db/client'
import { fetchActiveSecretPlaintext, SecretNotFoundError } from '@/lib/workspace-secrets/commands'

// The provider Cloudflare API token (Model B) is stored as a reserved,
// KEK-encrypted workspace secret on the default Workspace, set once via the
// secrets path. Account id, zone id, and hostname base are non-secret vars.
export const CF_PROVIDER_TOKEN_SECRET = '__cf_provider_api_token'

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

export interface ProviderVars {
  accountId: string
  zoneId: string
  hostnameBase: string
}

export async function getProviderConfig(deps: {
  db: Database
  kek: string
  workspaceId: string
  vars: ProviderVars
}): Promise<ProviderConfig> {
  const { accountId, zoneId, hostnameBase } = deps.vars
  if (!accountId || !zoneId || !hostnameBase) {
    throw new TunnelProvisioningNotConfiguredError(
      'Set CF_PROVIDER_ACCOUNT_ID, CF_PROVIDER_ZONE_ID, and CF_TUNNEL_HOSTNAME_BASE.',
    )
  }
  let apiToken: string
  try {
    apiToken = await fetchActiveSecretPlaintext(
      { db: deps.db, kek: deps.kek },
      deps.workspaceId,
      CF_PROVIDER_TOKEN_SECRET,
    )
  } catch (err) {
    if (err instanceof SecretNotFoundError) {
      throw new TunnelProvisioningNotConfiguredError(
        `Store the Cloudflare API token as the "${CF_PROVIDER_TOKEN_SECRET}" workspace secret.`,
      )
    }
    throw err
  }
  return { cf: createCloudflareApi({ accountId, apiToken }), zoneId, hostnameBase }
}
