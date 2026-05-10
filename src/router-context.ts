// Router context shape. Must stay an `interface` so recipes can augment
// it via TypeScript module declaration merging without forking this file.
import type { QueryClient } from '@tanstack/react-query'

export interface MyRouterContext {
  queryClient: QueryClient
}
