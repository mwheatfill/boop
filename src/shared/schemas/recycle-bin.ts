import { z } from './openapi'

// The soft-deleted entity kinds that have a Recycle Bin home. Tunnels are
// permanent-delete (Cloudflare teardown), so they never appear here.
export const DELETED_KINDS = ['job', 'target', 'channel', 'alert-rule'] as const
export type DeletedKind = (typeof DELETED_KINDS)[number]

export const PurgeInput = z
  .object({
    kind: z.enum(DELETED_KINDS),
    workspaceSlug: z.string().min(1),
    slug: z.string().min(1),
  })
  .meta({
    id: 'PurgeInput',
    description:
      'Permanently removes one soft-deleted resource, identified by kind, workspace slug, and resource slug.',
  })
export type PurgeInput = z.infer<typeof PurgeInput>
