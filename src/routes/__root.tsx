/// <reference types="vite/client" />
import { queryOptions } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { createRootRouteWithContext, HeadContent, Link, Scripts } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import type { ReactNode } from 'react'
import { ThemeProvider } from '@/components/ThemeProvider'
import { ThemeToggle } from '@/components/ThemeToggle'
import { Toaster } from '@/components/ui/sonner'
import { getCurrentUserFn } from '@/lib/auth/server-fns'
import type { MyRouterContext } from '@/router-context'
import appCss from '@/styles/app.css?url'

const currentUserQueryOptions = queryOptions({
  queryKey: ['auth', 'currentUser'],
  queryFn: () => getCurrentUserFn(),
  staleTime: Number.POSITIVE_INFINITY,
})

export const Route = createRootRouteWithContext<MyRouterContext>()({
  beforeLoad: async ({ context }) => {
    const currentUser = await context.queryClient.ensureQueryData(currentUserQueryOptions)
    return { currentUser }
  },
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'boop' },
      {
        name: 'description',
        content: 'Cloudflare Workers + TanStack Start template.',
      },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        <ThemeProvider>
          <header className="border-b border-border">
            <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
              <div className="flex items-center gap-6">
                <Link
                  to="/"
                  className="text-sm font-semibold tracking-tight"
                  activeProps={{ className: 'text-primary' }}
                >
                  boop
                </Link>
                <Link
                  to="/customers"
                  className="text-sm text-muted-foreground hover:text-foreground"
                  activeProps={{ className: 'text-foreground' }}
                >
                  Customers
                </Link>
              </div>
              <ThemeToggle />
            </div>
          </header>
          <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
          <Toaster />
          {import.meta.env.DEV && (
            <>
              <TanStackRouterDevtools position="bottom-right" />
              <ReactQueryDevtools buttonPosition="bottom-left" />
            </>
          )}
          <Scripts />
        </ThemeProvider>
      </body>
    </html>
  )
}
