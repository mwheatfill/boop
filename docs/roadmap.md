---
title: "Roadmap"
type: "Open work"
status: Active
description: "What's left to ship, in priority order, with enough context for a fresh session to pick up cleanly."
---

# Roadmap

The template is feature-complete for "what every Cloudflare Workers + TanStack Start app needs." Three milestones remain. Each is independent enough to start in isolation; the recommended order minimizes rework.

## Current state (May 2026)

- **Stack pinned and audit-enforced.** [`agent-rules/preferences.md`](../agent-rules/preferences.md) is the canonical-choice list (~22 rows covering routing, query, forms, validation, UI primitives, headless, charts, animation, dashboard, toasts, dates, fonts, currency, markdown, logging, error monitoring, analytics, client state, component dev env, postgres swap, chat UI, email transport, rich-text, billing, background jobs, real-time, search, image optimization, env var policy). [`scripts/audit-patterns/preferences.ts`](../scripts/audit-patterns/preferences.ts) blocks every "don't reach for" entry mechanically.
- **Three audits run on every PR.** Shadcn structural-diff against the live registry, TanStack pattern assertions against version-locked Intent skills, and the preferences grep. See [ADR-0011](adr/0011-opinionated-stack-and-pattern-enforcement.md) for the rationale.
- **Wired in `src/lib/`:** `auth/get-current-user`, `db/client`, `db/schema` (empty), `query-client`, `log` (structured `console.*` wrapper), `format` (Intl-based `formatMoney`/`formatNumber`/`formatPercent`), `utils` (`cn`).
- **Wired in `src/components/`:** Button + Card from canonical shadcn `base-vega` (Base UI primitives), Sonner Toaster mounted in `__root.tsx`, ThemeProvider + ThemeToggle, DefaultCatchBoundary + NotFound.
- **CI:** `main.yml` (check + dev deploy on push to `main`), `deploy-production.yml` (prod deploy on `v*.*.*` tags), composite `setup` action shared between them, audit-patterns posts a PR comment with findings.
- **Unverified:** production deploy has never run end-to-end. Dev deploy is verified; prod is not.

## Milestones

### 1. Production deploy verification

**Smallest item; do this first.** It de-risks the wrangler.jsonc env.production block, the deploy-production.yml workflow, and the `--env production` migration apply. None of these have been exercised end-to-end against Cloudflare; a tag cut now will surface any gap before later work depends on it.

Steps:
1. Bump `package.json` `version` to `0.0.1`.
2. Tag: `git tag v0.0.1 && git push origin v0.0.1`.
3. Watch `deploy-production.yml` in GitHub Actions. Quality gates run on the tagged SHA, then build with `CLOUDFLARE_ENV=production`, then `wrangler d1 migrations apply DB --env production --remote` (no-op for the empty schema), then `wrangler deploy`.
4. Confirm `template-cf-fullstack-prod` worker is up at `https://template-cf-fullstack-prod.<account-subdomain>.workers.dev`. Hit `/` and verify the home page renders with `PUBLIC_ENV=production` shown in the footer.
5. If the worker fails to start, the most likely culprits in order: missing `CLOUDFLARE_ENV=production` env at job level, missing GitHub environment secrets (`CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` not configured for the `production` environment), the env.production D1 binding pointing at an ID that doesn't exist on the account.

Scope: one commit (version bump + tag); execution is automated by `deploy-production.yml`. Failure surface is bounded to the three culprits above, each with a known fix.

### 2. M7 wave two — build the planned recipes

The [`app-platform-recipes` repo's `README.md` "Planned recipes" section](https://github.com/mwheatfill/app-platform-recipes#planned-recipes) lists ~25 planned recipes. Six exist today (`auth/better-auth`, `ai/chat-route`, `ai/chat-ui`, `email/send-pipeline`, `email/welcome-template`, `email/graph-shared-mailbox`, `microsoft-foundry/chat-completion`, `mcp/expose-app-as-mcp-server`, plus the Azure-template recipes).

Recipe build pattern (use `recipes/auth/better-auth/` as the reference):
- `recipes/<domain>/<name>/README.md` — what it adds, when to install, what to configure after, what's NOT covered
- `recipes/<domain>/<name>/files/` — files copied verbatim into the consuming app (mirror of destination paths)
- `recipes/<domain>/<name>/install.sh` (optional) — `pnpm add` for new deps, post-copy steps, env-var prompts
- `recipes/<domain>/<name>/compatibility.json` — declared `templates`, required versions

Suggested priority (highest-leverage first):
1. **`monitoring/sentry`** — most apps will install this on day 1. Wires `@sentry/cloudflare` + `@sentry/react` + source maps, overlays `src/lib/log.ts` to add `Sentry.captureException` + `Sentry.addBreadcrumb`.
2. **`charts/setup`** — installs shadcn Chart + adds an example chart route showing area + bar + tooltip wired into the QueryClient pattern.
3. **`motion/setup`** — installs `motion`, adds a minimal animated example so the import pattern is visible.
4. **`dashboard/scaffold`** — runs `npx shadcn@latest add dashboard-01` and adapts it to use `MyRouterContext` + the template's auth abstraction.
5. **`data-layer/switch-to-neon-postgres`** — the two-tier driver guidance (default `@neondatabase/serverless`, scale-up to Hyperdrive + postgres-js); see [`agent-rules/preferences.md`](../agent-rules/preferences.md) → "Postgres swap" for the spec.
6. **`billing/stripe`** — Stripe SDK + webhook receiver + customer portal redirect + subscription state cached in D1.
7. **`editor/tiptap`** — TipTap (`@tiptap/core` + `@tiptap/pm`) wired into a Zod-validated form field.
8. **`background/queue-consumer`, `cron-trigger`, `workflow`** — Cloudflare-native primitives, one recipe per primitive.
9. **`realtime/durable-object-websocket`** — DO + WebSocketPair pattern.
10. **`search/d1-fts5`, `vectorize`, `cloudflare-ai-search`** — the three-tier search story; AI Search is the new April-2026 hybrid option.
11. The remaining recipes (auth/cloudflare-access, monitoring/posthog, monitoring/azure-app-insights, monitoring/otel-export, monitoring/cloudflare-logpush-r2, email/resend, email/cloudflare-email-service, images/cloudflare-images, drizzle/d1-migration, entra/group-claim-extraction, webhooks/*, teams/*, pagerduty/*, agent-guards/add-a-guard, testing/playwright-e2e, health-endpoint/setup, cloudflare/workers-builds-setup, cloudflare-tunnel/add-target, autotask/ticket-create) — fill in by demand.

Scope: ~25 small recipes (one README + one `files/` tree + optional `install.sh` + `compatibility.json` per recipe). Independent of each other — high parallelization potential, easy to delegate one recipe per agent session.

### 3. M8 composer surface

Interactive recipe selection during bootstrap, plus an agent-callable scaffold skill. **Depends on M7** — most recipes need to exist before the composer has anything to offer.

Two surfaces:

**(a) Interactive `pnpm bootstrap` extension.** After the existing rename + .dev.vars + intent install steps, a final step lists installable recipes from `app-platform-recipes` (read from a manifest) with checkboxes. User selects → composer runs each recipe's installer in order, respecting `compatibility.json` declared dependencies.

**(b) `/scaffold` agent skill.** Lives in `.claude/skills/scaffold/` (or wherever the harness expects). When invoked, the agent reads the user's request ("add billing", "I need real-time"), maps to the appropriate recipe(s), confirms with the user, then runs the same installer the bootstrap composer would.

Spec hints:
- The recipes repo needs a machine-readable manifest at the root (`recipes.json` or similar) listing all recipes with `id`, `domain`, `description`, `dependencies` (other recipe ids), `templates` (cf-fullstack | az-spa | az-fullstack), and `status` (built | planned).
- The composer installer is essentially the existing `install.sh` from app-platform-recipes wrapped in a TUI / agent-friendly interface.
- The composer needs to handle the existing `compatibility.json` `requires` field (e.g., `ai/chat-route` requires an auth recipe).

Scope: two surfaces (TUI + agent skill). The TUI shell is a wrapper around the existing per-recipe `install.sh`. The recipe-graph resolution (compatibility.json `requires` chains) is the interesting bit — a topological sort over the manifest with cycle detection.

## How the milestones interact

- **(1) is independent** — do it first to surface any production-deploy gaps while the recent CI changes are still fresh in your head.
- **(2) is the bulk of the remaining work** — each recipe is a small focused task, easy to delegate to agent sessions.
- **(3) depends on (2)** — the composer needs recipes to compose. Could start the composer's TUI / agent-skill scaffolding in parallel with late-stage M7 work.

## Things explicitly NOT on the roadmap

- Switching templates (cf-fullstack stays on TanStack Start + Cloudflare Workers; the Azure templates are separate).
- Adding more frameworks to the same template (no Hono variant, no Next.js variant — those would be separate templates).
- Building a recipe registry website / catalog UI (the `README.md` table is the catalog; see ADR-0009 for the discoverability stance).
- Pinning a font, charts library, motion library, or dashboard layout in the template itself (per-app design decisions; see preferences.md).
