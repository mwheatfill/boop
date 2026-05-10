import { createFileRoute } from '@tanstack/react-router'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export const Route = createFileRoute('/')({
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

      <section className="grid gap-3 sm:grid-cols-2">
        {docLinks.map((link) => (
          <a
            key={link.href}
            href={link.href}
            target="_blank"
            rel="noreferrer"
            className="block transition-colors hover:bg-muted"
          >
            <Card className="h-full p-4">
              <CardHeader className="p-0">
                <CardTitle className="text-sm">{link.title}</CardTitle>
                <CardDescription>{link.description}</CardDescription>
              </CardHeader>
            </Card>
          </a>
        ))}
      </section>
    </div>
  )
}
