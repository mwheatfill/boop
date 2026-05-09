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
          TanStack Start, D1 + Drizzle, Better Auth, AI SDK + AI Elements, React Email, and an
          agent-ready governance layer baked in. Edit{' '}
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-sm">
            src/routes/index.tsx
          </code>{' '}
          to start.
        </p>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <DocLink
          href="/AGENTS.md"
          title="AGENTS.md"
          description="Canonical entry for AI coding agents working in this repo."
        />
        <DocLink
          href="/docs/adr/README.md"
          title="Architecture Decision Records"
          description="Why each platform, framework, and library choice was made."
        />
        <DocLink
          href="/agent-rules"
          title="Agent rules"
          description="Cross-harness governance: lookup order, dependencies, conventions."
        />
        <DocLink
          href="https://github.com/mwheatfill/app-platform-recipes"
          title="Recipes"
          description="Optional capabilities: Neon swap, Cloudflare Access, MCP server, more."
        />
      </section>
    </div>
  )
}

function DocLink({
  href,
  title,
  description,
}: {
  href: string
  title: string
  description: string
}) {
  return (
    <a
      href={href}
      className="rounded-lg border border-border bg-card p-4 text-card-foreground transition-colors hover:bg-muted"
    >
      <p className="text-sm font-semibold">{title}</p>
      <p className="text-sm text-muted-foreground">{description}</p>
    </a>
  )
}
