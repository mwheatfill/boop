import type { QueryClient } from '@tanstack/react-query'
import type { User } from '@/shared/schemas/auth'

export interface MyRouterContext {
  queryClient: QueryClient
  currentUser: User | null
}
