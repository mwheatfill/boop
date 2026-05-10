// Router context shape. Recipes augment via TypeScript module declaration
// merging so they can inject services (auth client, db handle, etc.) into
// route loaders and beforeLoad without forking this file.
//
// Example (an auth recipe would add):
//
//   // src/lib/auth/router-context.ts
//   import 'src/router-context'
//   declare module 'src/router-context' {
//     interface MyRouterContext {
//       auth: { user: User | null }
//     }
//   }
//
// Then a route can do:
//
//   beforeLoad: ({ context }) => {
//     if (!context.auth.user) throw redirect({ to: '/login' })
//   }
import type { QueryClient } from '@tanstack/react-query'

export interface MyRouterContext {
  // queryClient is required because the template ships TanStack Query.
  // setupRouterSsrQueryIntegration in src/router.tsx ties it to the
  // SSR dehydration boundary; route loaders use it via
  //   `context.queryClient.ensureQueryData(myQueryOptions)`.
  queryClient: QueryClient
}
