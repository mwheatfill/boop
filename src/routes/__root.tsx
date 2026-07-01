/// <reference types="vite/client" />
import { queryOptions } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { createRootRouteWithContext, HeadContent, Scripts } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import type { ReactNode } from 'react'
import { ThemeProvider } from '@/components/ThemeProvider'
import { Toaster } from '@/components/ui/sonner'
import { authKeys } from '@/lib/auth/keys'
import { getCurrentUserFn } from '@/lib/auth/server-fns'
import type { MyRouterContext } from '@/router-context'
import appCss from '@/styles/app.css?url'

const currentUserQueryOptions = queryOptions({
  queryKey: authKeys.currentUser(),
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
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon-32x32.png' },
      { rel: 'icon', type: 'image/png', sizes: '16x16', href: '/favicon-16x16.png' },
      { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' },
    ],
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
          {children}
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
