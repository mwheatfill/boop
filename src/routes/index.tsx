import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: HomePage,
})

function HomePage() {
  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          template-cf-fullstack
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
    </div>
  )
}
