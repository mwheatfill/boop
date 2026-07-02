import { env } from 'cloudflare:workers'
import { createServerFn } from '@tanstack/react-start'
import { authMiddleware } from '@/lib/auth/auth-middleware'
import { DirectorySearchInput, type DirectorySearchResult } from '@/shared/schemas/directory'
import { directoryConfigFromEnv, searchDirectory } from './graph-directory'

// Auth-gated directory search. When directory credentials are absent (dev/local,
// or before GRAPH_DIR_CLIENT_SECRET is set) it returns `available: false` so the
// picker degrades to plain email entry instead of failing.
export const searchDirectoryFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator((data: { workspaceSlug: string; query: string }) =>
    DirectorySearchInput.parse(data),
  )
  .handler(async ({ data }): Promise<DirectorySearchResult> => {
    const config = directoryConfigFromEnv(env)
    if (!config) return { available: false, results: [] }
    const query = data.query.trim()
    if (!query) return { available: true, results: [] }
    return { available: true, results: await searchDirectory(config, query) }
  })
