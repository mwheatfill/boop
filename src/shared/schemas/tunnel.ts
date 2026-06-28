import { nameField, slugField } from './fields'
import { z } from './openapi'

// Cloudflare connector status (connector <-> Cloudflare edge), per ADR-028.
export const TUNNEL_CONNECTOR_STATUSES = ['healthy', 'degraded', 'down', 'inactive'] as const
// boop's end-to-end verify outcome (origin + Access policy reachable).
export const TUNNEL_VERIFY_OUTCOMES = [
  'ok',
  'unauthorized',
  'forbidden',
  'network',
  'unknown',
] as const
export type TunnelVerifyOutcome = (typeof TUNNEL_VERIFY_OUTCOMES)[number]
// Certificate-pack status, collapsed (active / still issuing / stuck).
export const TUNNEL_CERT_STATUSES = ['active', 'pending', 'error'] as const
// The operator-facing tunnel lifecycle state, derived from connector + cert status.
export const TUNNEL_STATES = [
  'provisioning', // boop creating resources / certificate issuing
  'install_pending', // ready; connector not yet connected (operator runs the install command)
  'operational', // connector connected + certificate active
  'attention', // connector degraded/down, or certificate error
] as const

export const TunnelSchema = z
  .object({
    id: z.string().meta({ example: 'tnl_abc123' }),
    workspaceId: z.string().meta({ example: 'cust_abc123' }),
    name: z.string().meta({ example: 'Acme HQ' }),
    slug: z.string().meta({ example: 'acme-hq' }),
    hostname: z.string().meta({ example: 'acme-hq.tunnels.stlabs.org' }),
    connectorStatus: z.enum(TUNNEL_CONNECTOR_STATUSES).nullable(),
    connectorCheckedAt: z.iso.datetime().nullable(),
    certStatus: z.enum(TUNNEL_CERT_STATUSES).nullable(),
    lastVerifyOutcome: z.enum(TUNNEL_VERIFY_OUTCOMES).nullable(),
    lastVerifiedAt: z.iso.datetime().nullable(),
    state: z.enum(TUNNEL_STATES),
    status: z.enum(['active', 'archived']),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .meta({
    id: 'Tunnel',
    description: 'A Cloudflare Tunnel to a private-network origin, owned by a Workspace.',
  })

export type Tunnel = z.infer<typeof TunnelSchema>

export const TunnelCreateInput = z
  .object({
    name: nameField,
    slug: slugField,
  })
  .meta({ id: 'TunnelCreateInput' })

export type TunnelCreateInput = z.infer<typeof TunnelCreateInput>

export const TunnelVerifyResultSchema = z
  .object({
    ok: z.boolean(),
    outcome: z.enum(TUNNEL_VERIFY_OUTCOMES),
    detail: z.string(),
  })
  .meta({ id: 'TunnelVerifyResult' })

export type TunnelVerifyResult = z.infer<typeof TunnelVerifyResultSchema>
