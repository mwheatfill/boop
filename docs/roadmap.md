# Roadmap

The template's framework wiring is complete; remaining work is the recipe library and the composer surface.

## Current state (May 2026)

- **Stack locked.** `pnpm audit:patterns` runs three structural checks per PR: shadcn registry diff (catches drift when shadcn changes a primitive upstream), TanStack pattern assertions against version-locked Intent skills, and architectural-seam guards in [`scripts/audit-patterns/preferences.ts`](../scripts/audit-patterns/preferences.ts) (5 rules: `@/lib/log` seam, `getCurrentUser` seam, Base UI vs Radix, single-`wrangler.jsonc` CI pattern, direct-console). Preferences (TanStack Query vs swr, Zod vs Yup, etc.) live in AGENTS.md and are caught by the `pnpm add` permission gate, not by the audit. See [ADR-009](adr/009-opinionated-stack-and-pattern-enforcement.md).
- **Wired in `src/lib/`:** `auth/get-current-user`, `db/client`, `db/schema` (empty), `query-client`, `log` (structured `console.*` wrapper), `format` (Intl-based `formatMoney`/`formatNumber`/`formatPercent`), `utils` (`cn`).
- **Wired in `src/components/`:** Button + Card from canonical shadcn `base-vega` (Base UI primitives), Sonner Toaster mounted in `__root.tsx`, ThemeProvider + ThemeToggle, DefaultCatchBoundary + NotFound.
- **CI:** `main.yml` (check + dev deploy on push to `main`), `deploy-production.yml` (prod deploy on `v*.*.*` tags), composite `setup` action shared between them. Gates: Biome, build, vitest, `openapi:check`, `audit:patterns`.
- **Deployed:** dev at `https://template-cf-fullstack-dev.stelcollective.workers.dev`, prod at `https://template-cf-fullstack-prod.stelcollective.workers.dev`.

## Milestones

### 1. M7 wave two, build the planned recipes

The [`app-platform-recipes` repo's `README.md` "Planned recipes" section](https://github.com/mwheatfill/app-platform-recipes#planned-recipes) lists ~25 planned recipes. Six exist today (`auth/better-auth`, `ai/chat-route`, `ai/chat-ui`, `email/send-pipeline`, `email/welcome-template`, `email/graph-shared-mailbox`, `microsoft-foundry/chat-completion`, `mcp/expose-app-as-mcp-server`, plus the Azure-template recipes).

Recipe build pattern (use `recipes/auth/better-auth/` as the reference):
- `recipes/<domain>/<name>/README.md`: what it adds, when to install, what to configure after, what's NOT covered
- `recipes/<domain>/<name>/files/`: files copied verbatim into the consuming app (mirror of destination paths)
- `recipes/<domain>/<name>/install.sh` (optional): `pnpm add` for new deps, post-copy steps, env-var prompts
- `recipes/<domain>/<name>/compatibility.json`: declared `templates`, required versions

Suggested priority (highest-leverage first):
1. **`monitoring/sentry`**: most apps will install this on day 1. Wires `@sentry/cloudflare` + `@sentry/react` + source maps, overlays `src/lib/log.ts` to add `Sentry.captureException` + `Sentry.addBreadcrumb`.
2. **`charts/setup`**: installs shadcn Chart + adds an example chart route showing area + bar + tooltip wired into the QueryClient pattern.
3. **`motion/setup`**: installs `motion`, adds a minimal animated example so the import pattern is visible.
4. **`dashboard/scaffold`**: runs `npx shadcn@latest add dashboard-01` and adapts it to use `MyRouterContext` + the template's auth abstraction.
5. **`data-layer/switch-to-neon-postgres`**: the two-tier driver guidance (default `@neondatabase/serverless`, scale-up to Hyperdrive + postgres-js).
6. **`billing/stripe`**: Stripe SDK + webhook receiver + customer portal redirect + subscription state cached in D1.
7. **`editor/tiptap`**: TipTap (`@tiptap/core` + `@tiptap/pm`) wired into a Zod-validated form field.
8. **`background/queue-consumer`, `cron-trigger`, `workflow`**: Cloudflare-native primitives, one recipe per primitive.
9. **`realtime/durable-object-websocket`**: DO + WebSocketPair pattern.
10. **`search/d1-fts5`, `vectorize`, `cloudflare-ai-search`**: the three-tier search story; AI Search is the new April-2026 hybrid option.
11. The remaining recipes (auth/cloudflare-access, monitoring/posthog, monitoring/azure-app-insights, monitoring/otel-export, monitoring/cloudflare-logpush-r2, email/resend, email/cloudflare-email-service, images/cloudflare-images, drizzle/d1-migration, entra/group-claim-extraction, webhooks/*, teams/*, pagerduty/*, agent-guards/add-a-guard, testing/playwright-e2e, health-endpoint/setup, cloudflare/workers-builds-setup, cloudflare-tunnel/add-target, autotask/ticket-create): fill in by demand.

Scope: ~25 small recipes (one README + one `files/` tree + optional `install.sh` + `compatibility.json` per recipe). Independent of each other, high parallelization potential, easy to delegate one recipe per agent session.

### 2. M8 composer surface

Interactive recipe selection during bootstrap, plus an agent-callable scaffold skill. **Depends on M7**: most recipes need to exist before the composer has anything to offer.

Two surfaces:

**(a) Interactive `pnpm bootstrap` extension.** After the existing rename + .dev.vars + intent install steps, a final step lists installable recipes from `app-platform-recipes` (read from a manifest) with checkboxes. User selects, composer runs each recipe's installer in order, respecting `compatibility.json` declared dependencies.

**(b) `/scaffold` agent skill.** Lives in `.claude/skills/scaffold/` (or wherever the harness expects). When invoked, the agent reads the user's request ("add billing", "I need real-time"), maps to the appropriate recipe(s), confirms with the user, then runs the same installer the bootstrap composer would.

Spec hints:
- The recipes repo needs a machine-readable manifest at the root (`recipes.json` or similar) listing all recipes with `id`, `domain`, `description`, `dependencies` (other recipe ids), `templates` (cf-fullstack | az-spa | az-fullstack), and `status` (built | planned).
- The composer installer is essentially the existing `install.sh` from app-platform-recipes wrapped in a TUI / agent-friendly interface.
- The composer needs to handle the existing `compatibility.json` `requires` field (e.g., `ai/chat-route` requires an auth recipe).

Scope: two surfaces (TUI + agent skill). The TUI shell is a wrapper around the existing per-recipe `install.sh`. The recipe-graph resolution (compatibility.json `requires` chains) is the interesting bit: a topological sort over the manifest with cycle detection.

## How the milestones interact

- **(1) is the bulk of the remaining work**: each recipe is a small focused task, easy to delegate to agent sessions.
- **(2) depends on (1)**: the composer needs recipes to compose. Could start the composer's TUI / agent-skill scaffolding in parallel with late-stage M7 work.

## Things explicitly NOT on the roadmap

- Switching templates (cf-fullstack stays on TanStack Start + Cloudflare Workers; the Azure templates are separate).
- Adding more frameworks to the same template (no Hono variant, no Next.js variant; those would be separate templates).
- Building a recipe registry website / catalog UI (the `README.md` table is the catalog; see ADR-012 for the discoverability stance).
- Pinning a font, charts library, motion library, or dashboard layout in the template itself (per-app design decisions).
