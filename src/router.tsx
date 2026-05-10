import { createRouter } from '@tanstack/react-router'
import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query'
import { DefaultCatchBoundary } from '@/components/DefaultCatchBoundary'
import { NotFound } from '@/components/NotFound'
import { createQueryClient } from '@/lib/query-client'
import type { MyRouterContext } from '@/router-context'
import { routeTree } from './routeTree.gen'

export function getRouter() {
  // Per-request QueryClient: see src/lib/query-client.ts for why we don't
  // use a module-level singleton. setupRouterSsrQueryIntegration below
  // wires this client into the SSR dehydrate / client hydrate boundary.
  const queryClient = createQueryClient()

  const router = createRouter({
    routeTree,
    // Router context is typed via MyRouterContext (src/router-context.ts).
    // The template requires `queryClient`; recipes augment the interface
    // with additional services (auth, db, etc.) and pass them here.
    context: { queryClient } satisfies MyRouterContext,
    defaultPreload: 'intent',
    defaultErrorComponent: DefaultCatchBoundary,
    defaultNotFoundComponent: () => <NotFound />,
    scrollRestoration: true,
  })

  setupRouterSsrQueryIntegration({ router, queryClient })

  return router
}
