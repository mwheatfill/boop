/// <reference types="vite/client" />
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { createRootRouteWithContext, HeadContent, Link, Scripts } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import type { ReactNode } from 'react'
import { ThemeProvider } from '@/components/ThemeProvider'
import { ThemeToggle } from '@/components/ThemeToggle'
import { Toaster } from '@/components/ui/sonner'
import type { MyRouterContext } from '@/router-context'
import appCss from '@/styles/app.css?url'

export const Route = createRootRouteWithContext<MyRouterContext>()({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'template-cf-fullstack' },
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
      <body className="min-h-screen bg-background text-foreground antialiased">
        <ThemeProvider>
          <header className="border-b border-border">
            <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
              <Link
                to="/"
                className="text-sm font-semibold tracking-tight"
                activeProps={{ className: 'text-primary' }}
              >
                template-cf-fullstack
              </Link>
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
