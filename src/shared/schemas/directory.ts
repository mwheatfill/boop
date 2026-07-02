// Directory (Microsoft Entra) recipient search shapes for the email Channel
// picker. The picker resolves each pick to its email and stores the plain
// `recipients: array<email>` on the Channel config, so these types describe the
// lookup surface only, not persisted state. See ADR-013 (validated server-fn
// inputs enter the OpenAPI contract).
import { z } from './openapi'

export const DirectoryRecipientSchema = z
  .object({
    id: z.string().meta({ example: '3f2504e0-4f89-11d3-9a0c-0305e82c3301' }),
    displayName: z.string().meta({ example: 'Dana Ops' }),
    mail: z.string().meta({ example: 'dana@switchthink.com' }),
    type: z.enum(['user', 'group']),
  })
  .meta({
    id: 'DirectoryRecipient',
    description: 'An Entra user or mail-enabled group matched by a directory search.',
  })
export type DirectoryRecipient = z.infer<typeof DirectoryRecipientSchema>

export const DirectorySearchInput = z
  .object({ workspaceSlug: z.string().min(1), query: z.string() })
  .meta({
    id: 'DirectorySearchInput',
    description: 'Scopes a directory recipient search to a workspace with a free-text query.',
  })
export type DirectorySearchInput = z.infer<typeof DirectorySearchInput>

export const DirectorySearchResult = z
  .object({ available: z.boolean(), results: z.array(DirectoryRecipientSchema) })
  .meta({
    id: 'DirectorySearchResult',
    description:
      'Directory search results. `available` is false when directory credentials are absent, ' +
      'signalling the picker to fall back to plain email entry.',
  })
export type DirectorySearchResult = z.infer<typeof DirectorySearchResult>
