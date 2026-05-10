// Per-request QueryClient. Module-level singletons would leak cached
// data between concurrent SSR requests on the same Worker isolate.
import { QueryClient } from '@tanstack/react-query'

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
      },
    },
  })
}
