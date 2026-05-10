import { queryOptions, useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const getHealth = createServerFn({ method: 'GET' }).handler(async () => {
  const { env } = await import('cloudflare:workers')
  return {
    env: env.PUBLIC_ENV,
    appName: env.PUBLIC_APP_NAME,
    timestamp: new Date().toISOString(),
  }
})

const healthQueryOptions = queryOptions({
  queryKey: ['health'],
  queryFn: () => getHealth(),
})

export const Route = createFileRoute('/')({
  loader: ({ context }) => context.queryClient.ensureQueryData(healthQueryOptions),
  component: HomePage,
})

const docLinks = [
  {
    title: 'AGENTS.md',
    description: 'Canonical entry for AI coding agents working in this repo.',
    href: 'https://github.com/mwheatfill/template-cf-fullstack/blob/main/AGENTS.md',
  },
  {
    title: 'Architecture Decision Records',
    description: 'Why each platform, framework, and library choice was made.',
    href: 'https://github.com/mwheatfill/template-cf-fullstack/tree/main/docs/adr',
  },
  {
    title: 'Agent rules',
    description: 'Cross-harness governance: lookup order, dependencies, conventions.',
    href: 'https://github.com/mwheatfill/template-cf-fullstack/tree/main/agent-rules',
  },
  {
    title: 'Recipes',
    description: 'Optional capabilities: Better Auth, AI chat, email pipelines, MCP, more.',
    href: 'https://github.com/mwheatfill/app-platform-recipes',
  },
] as const

function HomePage() {
  const { data: health } = useSuspenseQuery(healthQueryOptions)

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {health.appName}
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">
          Build modern, secure, production-ready apps on Cloudflare.
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          TanStack Start on Cloudflare Workers with D1 + Drizzle, an empty schema, and an
          agent-ready governance layer. Add capabilities (auth, AI, email, MCP, more) by installing
          recipes from{' '}
          <a
            href="https://github.com/mwheatfill/app-platform-recipes"
            className="underline hover:text-foreground"
          >
            app-platform-recipes
          </a>
          . Edit{' '}
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-sm">
            src/routes/index.tsx
          </code>{' '}
          to start.
        </p>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        {docLinks.map((link) => (
          <a
            key={link.href}
            href={link.href}
            target="_blank"
            rel="noreferrer"
            className="block transition-colors hover:bg-muted"
          >
            <Card className="h-full">
              <CardHeader>
                <CardTitle className="text-sm">{link.title}</CardTitle>
                <CardDescription>{link.description}</CardDescription>
              </CardHeader>
            </Card>
          </a>
        ))}
      </section>

      <footer className="text-xs text-muted-foreground">
        <code className="font-mono">getHealth()</code> server fn → Query cache key{' '}
        <code className="font-mono">["health"]</code> → loader prefetch →{' '}
        <code className="font-mono">useSuspenseQuery</code> read. Returned{' '}
        <code className="font-mono">env={health.env}</code> at{' '}
        <time dateTime={health.timestamp}>{health.timestamp}</time>. Delete this footer once you
        have your own routes.
      </footer>
    </div>
  )
}
