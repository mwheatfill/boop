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
// The rolled-up status boop shows, fused from connector status + last verify + recent Run outcomes.
export const TUNNEL_HEALTH = [
  'operational',
  'degraded',
  'down',
  'not_connected',
  'unverified',
] as const

const originField = z
  .url('Must be a valid origin URL (e.g. http://10.0.1.50:8080)')
  .max(2048)
  .meta({ example: 'http://10.0.1.50:8080' })

export const TunnelSchema = z
  .object({
    id: z.string().meta({ example: 'tnl_abc123' }),
    workspaceId: z.string().meta({ example: 'cust_abc123' }),
    name: z.string().meta({ example: 'Acme HQ' }),
    slug: z.string().meta({ example: 'acme-hq' }),
    hostname: z.string().meta({ example: 'acme-hq.tunnels.stlabs.org' }),
    internalOrigin: z.string().meta({ example: 'http://10.0.1.50:8080' }),
    connectorStatus: z.enum(TUNNEL_CONNECTOR_STATUSES).nullable(),
    connectorCheckedAt: z.iso.datetime().nullable(),
    lastVerifyOutcome: z.enum(TUNNEL_VERIFY_OUTCOMES).nullable(),
    lastVerifiedAt: z.iso.datetime().nullable(),
    health: z.enum(TUNNEL_HEALTH),
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
    internalOrigin: originField,
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
