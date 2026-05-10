import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

// Canonical createServerFn pattern (from the version-locked TanStack
// Intent skill in node_modules/@tanstack/react-start/skills/react-start/SKILL.md).
// Server functions are RPC-style: defined here, callable from anywhere
// (route loaders, components via `useServerFn`, mutations). They run
// only on the server, so it's safe to import bindings from
// `cloudflare:workers` and read env vars / D1 / R2 / etc.
//
// Pattern to copy when adding a new server fn:
//   const myFn = createServerFn({ method: 'POST' })
//     .inputValidator((data) => MySchema.parse(data))
//     .handler(async ({ data }) => { /* server-only logic */ })
//
// Then wire it into a route via `loader: () => myFn(...)` (eager, runs
// during navigation) or call from a component via `useServerFn(myFn)`.
const getHealth = createServerFn({ method: 'GET' }).handler(async () => {
  const { env } = await import('cloudflare:workers')
  return {
    ok: true,
    env: env.PUBLIC_ENV,
    appName: env.PUBLIC_APP_NAME,
    timestamp: new Date().toISOString(),
  }
})

export const Route = createFileRoute('/')({
  // Route loader runs the server fn during navigation; the result is
  // available via `Route.useLoaderData()` in the component. Loaders are
  // isomorphic (server during SSR, client on subsequent navigations);
  // the server fn enforces the server-only boundary inside.
  loader: () => getHealth(),
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
  const health = Route.useLoaderData()

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
        <code className="font-mono">getHealth()</code> from the server fn returned{' '}
        <code className="font-mono">env={health.env}</code> at{' '}
        <time dateTime={health.timestamp}>{health.timestamp}</time>. This line proves the server-fn
        pattern is wired; delete it once you have your own routes.
      </footer>
    </div>
  )
}
