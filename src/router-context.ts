// Router context shape. Empty by default; recipes augment via TypeScript
// module declaration merging so they can inject services (auth client,
// query client, db handle, etc.) into route loaders and beforeLoad
// without forking this file.
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
//
// The empty interface here is intentional: it gives recipes a stable
// merge target. Don't replace it with `type MyRouterContext = {}` — the
// interface form is what enables module augmentation.
//
// biome-ignore lint/suspicious/noEmptyInterface: intentional augmentation seam
export interface MyRouterContext {}
