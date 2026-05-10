// QueryClient factory. Called once per request on the server (during SSR)
// and once on the client (at hydration). The factory shape lets recipes
// override defaults if they need different stale times, retries, etc.
//
// For SSR, prefer per-request instances over module-level singletons —
// otherwise cached data would leak between concurrent requests on the
// same Worker isolate. The setupRouterSsrQueryIntegration() call in
// router.tsx wires the dehydrate/hydrate boundary automatically.
import { QueryClient } from '@tanstack/react-query'

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // 60s stale time is the canonical TanStack Start example default;
        // it prevents an immediate client refetch of data that the server
        // just rendered. Tune per-query via `useQuery({ staleTime })` for
        // anything more time-sensitive.
        staleTime: 60 * 1000,
      },
    },
  })
}
