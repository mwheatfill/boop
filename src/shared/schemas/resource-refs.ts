// Routing/identity inputs shared across server functions: the slug- and
// id-based references that address a resource, plus the common listing toggles.
// These live here (not inline at the .inputValidator call site) so every
// validated server-fn input enters the OpenAPI contract. See ADR-013.
import { z } from './openapi'

export const SlugInput = z.object({ slug: z.string().min(1) }).meta({
  id: 'SlugInput',
  description: 'References a resource by its slug within the default workspace.',
})
export type SlugInput = z.infer<typeof SlugInput>

export const IdInput = z
  .object({ id: z.string().min(1) })
  .meta({ id: 'IdInput', description: 'References a resource by its opaque id.' })
export type IdInput = z.infer<typeof IdInput>

export const WorkspaceSlugInput = z.object({ workspaceSlug: z.string().min(1) }).meta({
  id: 'WorkspaceSlugInput',
  description: 'References a workspace by slug, scoping a listing or child-resource operation.',
})
export type WorkspaceSlugInput = z.infer<typeof WorkspaceSlugInput>

export const IncludeArchivedInput = z.object({ includeArchived: z.boolean().optional() }).meta({
  id: 'IncludeArchivedInput',
  description: 'Toggles whether archived (soft-deleted) rows are included in a listing.',
})
export type IncludeArchivedInput = z.infer<typeof IncludeArchivedInput>

export const OptionalWorkspaceScopeInput = z
  .object({
    workspaceSlug: z.string().min(1).optional(),
    includeArchived: z.boolean().optional(),
  })
  .meta({
    id: 'OptionalWorkspaceScopeInput',
    description: 'Optionally scopes a listing to one workspace and toggles archived rows.',
  })
export type OptionalWorkspaceScopeInput = z.infer<typeof OptionalWorkspaceScopeInput>

export const TargetSlugPairInput = z
  .object({ workspaceSlug: z.string().min(1), targetSlug: z.string().min(1) })
  .meta({
    id: 'TargetSlugPairInput',
    description: 'Addresses a Target by workspace slug and target slug.',
  })
export type TargetSlugPairInput = z.infer<typeof TargetSlugPairInput>

export const ChannelSlugPairInput = z
  .object({ workspaceSlug: z.string().min(1), channelSlug: z.string().min(1) })
  .meta({
    id: 'ChannelSlugPairInput',
    description: 'Addresses a Channel by workspace slug and channel slug.',
  })
export type ChannelSlugPairInput = z.infer<typeof ChannelSlugPairInput>

export const AlertRuleSlugPairInput = z
  .object({ workspaceSlug: z.string().min(1), ruleSlug: z.string().min(1) })
  .meta({
    id: 'AlertRuleSlugPairInput',
    description: 'Addresses an alert rule by workspace slug and rule slug.',
  })
export type AlertRuleSlugPairInput = z.infer<typeof AlertRuleSlugPairInput>

export const JobSlugPairInput = z
  .object({ workspaceSlug: z.string().min(1), jobSlug: z.string().min(1) })
  .meta({ id: 'JobSlugPairInput', description: 'Addresses a Job by workspace slug and job slug.' })
export type JobSlugPairInput = z.infer<typeof JobSlugPairInput>
