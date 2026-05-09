---
title: "Phase 1 Findings: HoopsLoop Survey for CF + TanStack Start Template"
type: "Working Note"
status: "Reviewed — decisions locked"
author: "Michael Wheatfill, Cloud & Collaboration Architect"
project: "Web Scheduler"
description: "Pattern extraction from the HoopsLoop reference app, with template/recipe/drop verdicts. Phase 1 review concluded; locked decisions captured below supersede any conflicting verdicts in the survey body."
---

# Phase 1 Findings: HoopsLoop Survey for CF + TanStack Start Template

## Decisions locked (Phase 1 review)

These supersede any conflicting verdicts in the patterns-by-domain section below; that section is preserved as the survey-as-written for traceability.

### AI stack

- **Chat UI:** Vercel AI Elements, not assistant-ui. Same shadcn-style ethos (components copied into the project, customizable, owned in-tree).
- **Streaming chat route:** ship as a removable example route in the template, with the `Content-Encoding: identity` Workers SSE fix in the handler.
- **Provider default:** Microsoft Foundry via Cloudflare AI Gateway. Anthropic and OpenAI as recipes.

### UI primitives and theming

- **Theme management:** keep `next-themes`. Despite the misnamed prefix it's the canonical shadcn pattern, framework-agnostic, no-flash trick non-trivial to own. (Reverses earlier "drop next-themes" verdict in the survey.) Add a one-line comment at the import site or in `agent-rules/architecture.md` explaining why a "next-" named package is in a TanStack Start app.
- **Date components:** use shadcn `Calendar` / `DatePicker`. `react-day-picker` rides along as the underlying engine. (Reverses the "drop react-day-picker" verdict.)

### Realtime

- **Durable Objects:** removable example only. Most internal apps will not need realtime.

### Observability

- **Template:** Pino structured logging + `GET /health` (DB ping, 200/503) + Zod-parsed env validation at startup.
- **Drop from template:** Sentry, PostHog. Move both to recipes if/when an app needs them.

### Quality gates (CI)

- **Hard gate:** `openapi-contract` — server functions must match the published `openapi.json`.
- **Soft gate:** `intent:stale` — TanStack Intent skill freshness vs. installed package versions; warns but does not block initially.
- **Not in template baseline:** the other ~12 HoopsLoop remediation guards. The pattern "how to add a guard" lives in a recipe; apps add guards as drift surfaces.

### Agent governance (load-bearing)

Neutral governance layer rather than rules tied to one harness's convention:

- **AGENTS.md** at repo root is the canonical entry. `CLAUDE.md` is a thin shim pointing at AGENTS.md. `.cursorrules` is a thin shim plus ~20 lines of high-priority rules inlined as a fallback.
- **`agent-rules/`** (no leading dot, harness-agnostic markdown):
  - `lookup-order.md` — 7-step doc protocol: project rules → Intent skills → MCP servers → llms.txt → vendor docs → web search → training data (verify).
  - `dependencies.md` — latest-stable selection, propose-and-confirm before adding deps, pinning policy (caret for app deps, exact for tools), removal protocol. Merged from earlier separate `version-pinning.md`.
  - `spec-fidelity.md` — locate spec at session start, re-anchor before architectural moves, propose spec edits rather than working around them.
  - `architecture.md` — auth boundaries, data flow, validation patterns.
  - `api-contract.md` — `openapi.json` is the contract; the openapi-contract guard protects it.
  - `intent.md` — cadence for TanStack Intent (install on bootstrap + dep change; load per-task during sessions; stale in CI; weekly maintenance check).
  - `conventions.md` — naming, formatting, error handling.
  - `codex-config.md` — Codex equivalents to the Claude Code permission and MCP setup; written against current Codex docs at scaffold time.
- **`.claude/settings.json`** is the Claude Code-specific gate file:
  - Permissions allow-list: `pnpm install`, `pnpm test`, `pnpm dev`, `pnpm build`, `pnpm check`, `npm view`, etc.
  - Permissions deny: `pnpm add`, `pnpm remove`, `pnpm update`, `pnpm uninstall` are NOT in the allow-list, so every dep change triggers a permission prompt even if the agent skips the proposal step.
  - MCP preconfig: Cloudflare Docs MCP, Microsoft Learn MCP, Context7 MCP. (TanStack docs MCP if/when published; Intent fills that role for TanStack libs in the meantime.)

### Discoverability + agent-ready surface (template, cheap)

About 100 lines of route handlers, sourced from data the template already produces:

- `public/robots.txt` with AI-bot directives
- `app/routes/sitemap.xml.ts` generated from the TSR route tree
- `app/routes/.well-known/api-catalog.ts` linking to `openapi.json`
- `app/routes/.well-known/oauth-protected-resource.ts` (Better Auth OIDC metadata)
- `app/routes/.well-known/mcp-server-card.ts` returns 404 unless the MCP server recipe is installed; returns metadata once it is
- Worker fetch handler adds `Link` response headers pointing at the well-known endpoints

The MCP server itself stays a recipe; the discovery layer ships in the template so apps that do install MCP get announced for free.

### Recipes repo

- **Reorg first** into the domain tree (option c). Existing four recipes (`+copilot-agent`, `+cmdk-prompt`, `+mcp-server`, `+graph-mail-send`) get new homes inside the domain structure.
- **Then** new recipes per the priority list. `mcp/expose-app-as-mcp-server.md` is the CF port of the existing `+mcp-server` recipe.
- **Defer:** `email/react-email-editor.md`. HoopsLoop has the dep but no UI pattern to lift.

### Template repo

- **Name:** `template-cf-fullstack`.
- **Working folder is the template:** `/Users/michael/Code/projects/claude/template-cf-fullstack`.

### Auth provider abstraction (template requirement)

Auth providers must live behind a `getCurrentUser(request)` abstraction in `src/lib/auth/`. Both Better Auth (default) and Cloudflare Access (recipe) implement the same interface and return the same `User` shape (`id`, `email`, `name?`, `groups[]`). The rest of the app reads from `getCurrentUser()` and is provider-agnostic, so the swap is mechanical: change one re-export, remove unused route handlers and Drizzle session tables, configure Cloudflare Access in the dashboard.

**HoopsLoop carryover:** HoopsLoop already has `getSessionFn` (server function caching session per request via `context.queryClient`) which is the same idea at the server-function layer. The template's `getCurrentUser(request)` generalizes it to any request-handler context (server functions, `.well-known` routes, middleware). The HoopsLoop implementation is the working starting point; the template just lifts the abstraction one layer down so it's reachable from non-server-function code paths as well.

**Tenant context is deliberately *not* in `User`.** Multi-tenant apps add a separate `getActiveTenant()` call rather than extending the identity shape. HoopsLoop's `activeClubId` (tenant scope alongside identity) is app-specific and stays app-specific; the template's auth abstraction is identity-only.

**Dev-mode bypass lives in the provider, not the dispatcher.** Each provider has its own dev-mode reality:
- Better Auth in dev: works as-is (local DB, redirects, sessions).
- Cloudflare Access in dev: no `Cf-Access-Jwt-Assertion` header (because `wrangler dev` doesn't traverse the edge), so the provider returns a configurable fake user gated on `import.meta.env.DEV`.

The recipe documents the bypass; the brief carries the abstraction shape only.

---

## Top-line summary

HoopsLoop is a production multi-tenant SaaS on Cloudflare Workers + TanStack Start with Neon Postgres (confirming that Hyperdrive swap pattern). The codebase demonstrates mature agent-readiness infrastructure that should be the template baseline:

1. **Agent-scaffolding patterns are load-bearing:** AGENTS.md (tight, intent-focused), .claude/rules/ directory with 15 guardrail rules (page-loading.md, database.md, deployment.md, observability.md, etc.), remediation scripts in package.json (14 guard-check scripts run in CI/CD), and .claude/settings.json + launch.json for Claude Code harness config. This is beyond boilerplate—it's a governance layer that belongs in every cloned app.

2. **Better Auth with Anthropic AI SDK (not Foundry):** HoopsLoop uses @ai-sdk/anthropic for Haiku-powered registration assistant and persona messages. The brief locks in Foundry as the default, so the template should abstract AI client provisioning via getAIClient() helper (already proven); recipes handle provider swap (Anthropic, OpenAI, Foundry). SSE streaming fix (Content-Encoding: identity) is absent here (Resend emails don't stream); note for template when streaming route is added.

3. **Zod + zod-openapi + schema-as-contract pattern:** Every server function has inputValidator() with Zod schemas. The zod-openapi pipeline generates openapi.json from decorated schemas; scripts/generate-openapi.ts runs in pnpm build. This is the data contract backbone—template-ready.

4. **Neon + Hyperdrive (not D1):** Two Hyperdrive bindings (read-write + cache layer), direct pg client setup, drizzle.config loads DATABASE_URL from .dev.vars. Hyperdrive patterns are Neon-specific; template defaults to D1 with Drizzle, so recipes swap adapter + wrangler.jsonc binding.

5. **Observability maturity is HoopsLoop-specific:** Sentry, PostHog, Pino structured logging, Workers Analytics. The brief captures this correctly—observability infra is optional for the template (health endpoint + env validation are not). Ship the health-check pattern, not the vendor integrations.

6. **Email is fully decoupled:** React Email 6 templates + Resend transport; emails render to HTML/text and send async with best-effort logging. The template pattern is identical; only the API key and send mechanism differ by recipe.

---

## Answers to the brief's nine open questions

1. **Auth pattern:** Better Auth (betterAuth v1.6.5) with Drizzle adapter, email + OAuth (Google/Apple configured but local dev uses email-OTP). No Cloudflare Access in use. Template default (Better Auth + Entra OIDC) is compatible; HoopsLoop lacks Entra integration only because it's consumer SaaS. File: src/server/auth/index.ts:1-40.

2. **Validation library:** Zod 4.3.6 with zod-openapi 5.4.6 for schema-first contracts. OpenAPI spec is built from Zod; every server function validates input at the edge. No Valibot in use. Zod is the lock-in.

3. **ORM:** Drizzle 0.45.2 with Neon Postgres (pg client). D1 support is possible via adapter swap (template's default). Migrations live in drizzle/ as SQL files; drizzle.config.ts reads DATABASE_URL. No Kysely.

4. **Component library:** shadcn/ui with base-ui primitives (base-nova style), Lucide icons. Theme provider is next-themes. No MUI or custom. File: components.json names "base-nova" style.

5. **wrangler.toml structure:** Multi-env (dev + production), each with env-specific Hyperdrive IDs, R2 buckets, Durable Objects, Queues, and cron triggers. Base config is in root; env overrides nest under "env": { "dev": {...}, "production": {...} }. Compatible template pattern.

6. **Testing pattern:** Vitest 4.1.5 + Testing Library (coverage config in vitest.config.ts with v8 provider and thresholds at 6.5% lines, 2% functions, 1.5% branches). No Playwright. tests/unit/ and tests/services/ structure. Template should include vitest baseline; Playwright can be a recipe if needed.

7. **GitHub Actions baseline:** .github/workflows/deploy-dev.yml and -production.yml are canonical. Quality gates: remediation scripts (identity-guard, route-data-guard, db-profile-guard, page-loading, bundle-budgets, openapi-contract), biome lint, build + tsc typecheck, then wrangler deploy. This is the template's deployment baseline.

8. **Monorepo/workspace:** No pnpm workspaces, no Turborepo. Single repo, single package. Clean.

9. **Styling approach:** Tailwind CSS v4.2.4, CSS variables for theme (light/dark/system via next-themes). No Panda CSS. tailwind.config in vite.config via @tailwindcss/vite plugin. Template lock-in.

---

## Patterns by domain

### Project bootstrap and scripts

HoopsLoop locks Node 24 LTS (engines: ">=24.0.0 <25"), pnpm 10.12.1. Scripts span dev/build/deploy, database (db:generate/migrate/push/studio/seed), openapi:generate, intent:list, 14 remediation checks, email:dev (React Email composer on port 3001), coverage/quality checks, husky prepare.

Verdict: **TEMPLATE**. Node version pinning (LTS lock, <next major) and pnpm lock are standard. All remediation:* scripts and CI/CD machinery are below. Copy the script structure; customize the remediation checks per brief requirements.

### wrangler.jsonc structure

Multi-env (dev + production), each with Hyperdrive bindings (2x IDs for read-write + cache), R2 buckets (storage, env-specific names), Durable Objects (ChannelRoom for real-time), Queues (producers + consumers with max_batch_size, max_retries, dead_letter_queue), cron triggers (0 6 * * * for daily, 0 12 * * SUN for weekly).

Template will use D1 instead of Hyperdrive; swap the binding shape. The multi-env pattern, cron config, and queue structure are all transferable.

Verdict: **TEMPLATE**. Shape the multi-env pattern into the template baseline; replace Hyperdrive with D1. Include example Durable Object binding and a simple cron trigger (health-check or cleanup). Queue bindings and migrations are optional examples (removable if app doesn't need them).

### Worker entry (src/worker.ts) and TanStack Start composition

Fetch handler wraps @tanstack/react-start/server-entry handler via handler.fetch(). Worker intercepts WebSocket upgrade to Durable Objects (/ws/channel/* routes to ChannelRoom), applies request-scoped cache wrapper (withRequestCache), and injects response normalization (content-type fixes for SW). Scheduled tasks and queue jobs use the same request-cache wrapper.

Sentry instrumentation wraps the Worker and Durable Objects; that's optional. The core pattern (TanStack handler + request cache + response normalization) is template-ready.

Verdict: **TEMPLATE**. Include the basic fetch/scheduled/queue structure with Sentry commented out and marked as optional recipe.

### Routing and server functions (TanStack Router file-based + auth patterns)

Routes live in src/routes/ with TSR file-based convention. Guard pattern is in .claude/rules/page-loading.md: beforeLoad for auth gate/RBAC/redirects/session resolution; loader for TanStack Query prefetch/ensureQueryData with // loader-block: <case> - <reason> comments for blocking awaits (allowed cases: render-decision, seo, above-fold, auth-gate); component renders unconditionally with data regions wrapped in <SectionBoundary skeleton={...}>.

Server functions in src/server/functions/*.ts use createServerFn() with .inputValidator() + .handler(). File: src/server/functions/chat.ts shows the shape (Zod schema, parse + call service).

Auth is resolved from session at server-function edge (getSessionFn server function caches session per request via context.queryClient).

Verdict: **TEMPLATE**. Include page-loading.md as the canonical routing rule; include an example auth-gated route (e.g., /app/dashboard) and a public route (e.g., /). Include example server function with schema validation. The SectionBoundary and skeleton pattern should be in component examples.

### Auth wiring (Better Auth + session patterns)

Better Auth is initialized in src/server/auth/index.ts with Drizzle adapter (PostgreSQL provider), emailAndPassword enabled, emailOTP + organization plugins, databaseHooks for user creation (link auth row to existing person record), sendChangeEmailConfirmation callback (conditional on RESEND_API_KEY).

Session is fetched via getSessionFn server function and cached in the router context queryClient. Routes call context.queryClient.ensureQueryData(sessionQueryOptions()) in beforeLoad.

RBAC happens via Better Auth organization; groups map to clubs in HoopsLoop (tenant). Pattern is "resolve session, read activeClubId from session, pass to service layer for tenant scoping."

Template default is Better Auth + Entra OIDC (not OAuth + email-OTP). The adapter shape is identical; only the OIDC config differs. File: src/server/auth/index.ts:21-80.

Verdict: **TEMPLATE**. Ship Better Auth initialization with email-password enabled (simpler than OIDC for local dev and onboarding). Move Entra OIDC config to a recipe (entra-oidc-setup.md). Include session fetch server function and the queryClient context pattern. Route guard pattern is covered in Routing section.

### Database layer (Drizzle + schema patterns, Neon-specific notes)

Drizzle client is created fresh per request in src/server/db/index.ts:

```typescript
export function createDb(databaseUrl: string) {
  const client = new Client({ connectionString: databaseUrl });
  client.connect();
  return drizzle({ client, schema });
}
```

Schema lives in src/server/db/schema/index.ts. Migrations are in drizzle/ as SQL files (0000_curvy_jackal.sql, etc.). Commands: db:generate (drizzle-kit generate), db:push (push schema to DB without migration files), db:migrate.

DATABASE_URL is loaded from environment (Cloudflare Secrets at deploy, .dev.vars locally). drizzle-kit reads it via readFileSync(".dev.vars") in drizzle.config.ts.

Hyperdrive (HoopsLoop-specific): two bindings, one for read-write, one cached. Pattern is env.HYPERDRIVE.connect() in a server function. D1 is simpler (no Hyperdrive, just a binding).

Verdict: **TEMPLATE** for Drizzle + schema patterns; **RECIPE** for Neon. Template should include D1 integration (no Hyperdrive). Recipes: switch-to-neon-postgres.md (swap drizzle dialect, add Hyperdrive bindings, update client wrapper).

### Validation and contracts (Zod + zod-openapi pipeline)

Schemas live in src/shared/schemas/ (club.ts, supportability.ts, etc.). Zod is extended with zod-openapi via src/shared/schemas/openapi.ts:

```typescript
import "zod-openapi";
import { z } from "zod";
export { z };
```

Server functions use .inputValidator((data) => schema.parse(data)). The scripts/generate-openapi.ts reads all schemas and writes openapi.json at build time. The spec includes security definitions (bearerAuth), servers, and component schemas. File: scripts/generate-openapi.ts:1-80.

Verdict: **TEMPLATE**. Include the zod-openapi setup, the generate-openapi.ts script, and an example schema. The validation pattern (server function input validator) is covered in Auth wiring and Server functions sections.

### API surface conventions (server function shape, error handling)

Server functions follow: .inputValidator((data) => schema.parse(data)) for runtime validation, then .handler(async ({ data }) => ...). Errors are thrown; the framework catches them and returns 4xx/5xx responses. No custom response envelope visible; HTTP status codes are implicit.

File: src/server/functions/chat.ts shows the shape—schema parse, then call a service.

Verdict: **TEMPLATE**. Document the server function shape (input validator + handler) and the error-first pattern. Include an example that calls a service function and handles errors gracefully (log + return user-friendly error).

### Components and design system (shadcn/ui + base-ui, theming)

shadcn/ui with base-ui primitives, base-nova style. Theme provider uses next-themes (light/dark/system). Components live in src/components/ui/ (copied from shadcn registry). Custom components in src/components/ (app-shell, page-layout, route-pending, etc.).

Tailwind v4 + @tailwindcss/vite plugin. CSS variables for theming. Lucide icons.

components.json configures the style (base-nova), tailwind entry, aliases.

Verdict: **TEMPLATE**. Include components.json with base-ui setup, a small set of shadcn components (Button, Card, Dialog, Form, Input, Select—the essentials), `next-themes` with the standard ThemeProvider + no-flash inline script, and a reference custom component (PageLayout or AppShell). [Decisions-locked update:] keep `next-themes` despite earlier flag — it is the shadcn-canonical pattern, framework-agnostic, and the no-flash trick is non-trivial to reimplement. Add a one-line comment at the import site noting the misnamed prefix.

### Forms, tables, virtualization

Package.json includes TanStack Form, TanStack Table 8.21.3, TanStack Virtual 3.13.24, react-day-picker 9.14.0 (date picker).

Verdict: **TEMPLATE**. Include TanStack Table + Virtual examples (table with sorting/pagination/virtualization). TanStack Form can be an example or a recipe. [Decisions-locked update:] use shadcn `Calendar` / `DatePicker` for date inputs; `react-day-picker` rides along as the underlying engine of those components, so it stays. Earlier "drop react-day-picker" verdict reversed.

### AI integration (assistant-ui + AI SDK wiring, streaming on Workers)

HoopsLoop uses Anthropic Haiku via @ai-sdk/anthropic (ai SDK v6.0.168, @ai-sdk/anthropic 3.0.71). The AI SDK is agnostic to provider; the brief locks Foundry as default, so generalize to getAIClient() helper that reads provider config from env.

Server function example: src/server/functions/chat.ts calls generatePersonaMessage() which uses createAnthropic() to create a client, then generateText() for non-streaming completions.

Streaming patterns not visible, but the brief notes "SSE Content-Encoding: identity gotcha"—Workers SSE streaming can send Content-Encoding: identity header which breaks chunked responses. The template should include this fix in the streaming route handler.

File: src/server/ai/registration-assistant.ts shows system prompt + tool definitions pattern.

Verdict: **TEMPLATE** for AI SDK wiring + getAIClient() helper + Vercel AI Elements + a streaming chat route example with the `Content-Encoding: identity` Workers SSE fix in the handler. **RECIPE** for Foundry setup (env vars, AI Gateway config, endpoint), Anthropic and OpenAI providers. [Decisions-locked update:] AI Elements replaces assistant-ui as the chat UI library; same shadcn-style ethos (components copied into the project). The streaming route is the canonical demo of the AI stack and stays in the template baseline (removable).

### Email layer (React Email 6 templates + Resend)

Templates live in src/server/email/templates/ as React components (event-created.tsx, game-day-reminder.shared.ts, etc.). React Email 6 imported from unified react-email package. Templates render to HTML + text via renderToHtml() and renderToText().

Send via src/server/email/send.ts wraps Resend with error logging (best-effort, no throw). File: src/server/email/send.ts:1-50.

Dev preview: email:dev runs React Email composer on port 3001.

Verdict: **TEMPLATE**. Include React Email 6 setup + one example template (welcome email). Include the send.ts wrapper pattern. email:dev script goes in package.json with port configurable. Recipes: graph-shared-mailbox.md, resend.md (API key config), cloudflare-email-service.md.

### Tests (vitest setup, Testing Library, no Playwright)

vitest.config.ts with globals: true, environment: node, include: tests/**/*.test.ts, Coverage provider: v8, thresholds: 6.5% lines, 2% functions, 1.5% branches (low by design; "freeze the current baseline first so the floor can ratchet upward").

No Playwright visible. Test structure: tests/unit/, tests/services/.

Verdict: **TEMPLATE**. Include vitest baseline config (globals, node env, coverage thresholds). Include one example unit test and one integration test (e.g., testing a server function). Playwright is optional; if needed, add as a recipe with example e2e test.

### CI/CD (GitHub Actions workflows)

Two canonical workflows: deploy-dev.yml (push to dev branch) and -production.yml. Quality gates in order: remediation:metrics, remediation:identity-guard, remediation:route-data-guard, remediation:db-profile-guard, remediation:dashboard-load-budget, remediation:page-loading, biome check, build + tsc, remediation:openapi-contract, remediation:bundle-budgets, wrangler deploy.

Environment variables from GitHub Secrets + vars. Deploy uses npx wrangler deploy --config dist/server/wrangler.json. File: .github/workflows/deploy-dev.yml:1-103.

Verdict: **TEMPLATE**. Include the workflow file structure (two envs), the quality gate ordering, and the deploy step. Remediation scripts are covered below; include 2-3 essential ones in the template (biome check, openapi-contract, page-loading), move others to recipes.

### Observability (Sentry + PostHog + Pino + Workers Analytics)

Sentry wraps the Worker fetch handler and Durable Objects. PostHog for analytics. Pino for structured logging (JSON output). Workers Analytics is native (observability: enabled in wrangler.jsonc).

This is HoopsLoop-specific; the template should be minimal. The brief mentions "what Michael should weigh"—observability is optional.

Verdict: **TEMPLATE** for health endpoint + /health route that pings the database and returns 200/503. Example structured logging (Pino) can be a recipe. Sentry/PostHog are consumer SaaS integrations; drop from template.

### Agent-onboarding surface (AGENTS.md, .claude/rules/, remediation scripts, intent system)

This is the most load-bearing pattern.

**AGENTS.md:** Tight, rule-focused document (168 lines). Sections: Read Order (NOW.md, architecture-current.md, architecture-target.md, PROGRESS.md only if needed); File Roles (each doc has one purpose; don't duplicate); Operating Rules (keep AGENTS.md short; prefer updating architecture docs); Dependency Selection (prefer current stable majors, document blockers); Truth And Direction (when current != target, current wins for safety, target wins for migrations); Implementation Rules (auth boundaries, data flow, validation, drift handling); Session Protocol (start with NOW.md + git log; end by updating NOW.md, PROGRESS.md); Deploy Verification (local checks are preflight; GitHub Actions is source of truth); Tech Stack Snapshot (locked versions, one per line); Documentation Lookup Order (llms.txt, MCP server, local skill, official docs, web search); Skill Mappings (commented section with intent:list commands for TanStack Start skills).

File: AGENTS.md:1-168.

**.claude/rules/ directory:** 15 rule files: page-loading.md (route loaders, beforeLoad/loader patterns, SectionBoundary, Suspense, no pendingComponent overrides); database.md (schema, migrations, RLS, tenant scoping); deployment.md (GitHub Actions, wrangler deploy, environment separation); observability.md (logging, metrics, Sentry/PostHog setup); architecture.md (auth, services, server functions, validation); data-mutations.md (forms, TanStack Query, optimistic updates); design-system.md (shadcn/ui setup, Tailwind, theme); testing.md (vitest, Testing Library, test structure); realtime-coverage.md (Durable Objects, WebSockets); seo.md (metadata, structured data, prerendering); local-dev.md (wrangler dev, .dev.vars, database setup); onboarding.md (agent-specific: read order, file roles, implementation rules).

Each file is 30-80 lines, rule-focused (not tutorials).

**Remediation scripts in package.json:** 14 scripts, each runs a Node/bash guard check: remediation:metrics (bash script); remediation:identity-guard (detect inputValidator((d) => d) no-op validators); remediation:server-auth-inventory (audit server functions for auth checks); remediation:openapi-contract (validate openapi.json against server functions); remediation:route-data-guard (check route loading patterns); remediation:db-profile-guard (detect N+1 queries or missing indexes); remediation:dashboard-load-budget (enforce bundle size limits per route); remediation:page-loading (enforce page-loading.md rules); remediation:bundle-budgets (enforce bundle size baseline).

Plus capture and report helpers (baselines, hotspots).

File: package.json:28-35, scripts in scripts/check-*.mjs and .sh.

**Intent system:** .claude/settings.json + .claude/launch.json configure Claude Code harness. package.json includes intent:list and intent:list:json scripts to enumerate TanStack Intent skills. Skill mappings are commented in AGENTS.md with npx commands to load skill files.

Example intent: "when working on TanStack Start app structure, load node_modules/@tanstack/react-start/skills/react-start/SKILL.md". The skill files are bundled in deps; intent:list discovers them.

Verdict: **TEMPLATE**. This is the governance backbone—include all of it. AGENTS.md is the canonical file; include the full pattern. .claude/rules/ directory should include the essentials (page-loading.md, database.md, architecture.md, testing.md, deployment.md), others can be recipes or optional. Remediation scripts: include identity-guard, page-loading, openapi-contract as CI/CD gates (the pattern matters more than every script). Include the intent system comments (intent:list) even if TanStack Intent skills aren't used initially.

### Misc helpers worth promoting

src/lib/utils.ts exports cn() (clsx + tailwind-merge for class composition). That's minimal but essential for shadcn components.

src/server/lib/request-cache.ts provides request-scoped caching for function results (avoids duplicate session fetches in one SSR pass). File: src/worker.ts:49 uses it.

src/server/lib/context.ts (not inspected) likely holds the context wrapper for auth/tenant/user.

Verdict: **TEMPLATE**. Include cn() utility. Include request-cache wrapper pattern in the worker entry example. Context helpers can be examples (AuthContext, TenantContext, etc.).

---

## Proposed template scope

### Infrastructure (always)

- Cloudflare Workers + TanStack Start (SSR + API routes)
- D1 SQLite database + Drizzle ORM (default; Neon swap is a recipe)
- Better Auth with email-password (Entra OIDC is a recipe)
- TanStack Router with file-based routes
- TanStack Query for client state
- TanStack Table + virtual scrolling
- Zod + zod-openapi for validation and contracts
- shadcn/ui with base-ui primitives + Tailwind v4 + theme provider
- React Email 6 for templating (Resend recipe, Graph recipe, Cloudflare Email recipe)
- AI SDK (ai npm package) with provider-agnostic getAIClient() helper (default: Foundry via AI Gateway; Anthropic/OpenAI are recipes)
- Vercel AI Elements (chat UI scaffolding; removable if no AI use case)
- Biome for formatting + linting + type check
- Vitest for unit tests
- GitHub Actions with quality gates (biome, build, type check, 3-5 remediation scripts, wrangler deploy)
- Husky + lint-staged for pre-commit hooks
- pnpm with Node 24 LTS lock
- AGENTS.md + .claude/rules/ + remediation script pattern (agent-onboarding baseline)
- Health endpoint (GET /health with database ping)
- Env validation (Zod schema parsed at startup)
- Error boundaries (React error boundaries on routes)
- Structured logging (Pino JSON output, optional recipe for vendor integration)
- Request cache wrapper (avoid duplicate session fetches in SSR)

### Scaffolding examples (one of each pattern, removable)

- Auth-gated route (/app/dashboard with beforeLoad guard)
- Public route (/ landing page)
- Server function with Zod validation + service call
- Form with TanStack Form + Zod schema
- Data table with TanStack Table (sorting, pagination, selection)
- Suspense-backed data region with skeleton
- React Email template example (welcome email)
- Durable Object example (optional; can be removed if not needed)
- Cron trigger example (optional; can be removed if not needed)
- Example unit test (Vitest)
- Example integration test (server function + DB)
- AI chat route (if AI use case; otherwise skip or mark as optional)

---

## Proposed initial recipes

From the brief, refined by findings:

1. **data-layer/switch-to-neon-postgres.md** — HoopsLoop pattern confirmed; straight-forward adapter + Hyperdrive binding swap. Works.

2. **ai/anthropic-chat-completion.md** — Anthropic is in HoopsLoop's deps; the pattern is proven (@ai-sdk/anthropic + generateText). Add as recipe alongside default Foundry setup.

3. **ai/microsoft-foundry-chat-completion.md** — Default provider. Covers env vars, AI Gateway config, multi-step tool calling, Vercel AI Elements components (Plan, Task, Tool, Confirmation, Workflow Canvas).

4. **cloudflare-access/jwt-validation.md** — Brief pattern; keep as recipe.

5. **entra/group-claim-extraction.md** — Brief pattern; Better Auth supports org groups; document mapping to app RBAC. Keep as recipe.

6. **webhooks/hmac-validation.md** — Brief pattern; keep as recipe.

7. **webhooks/inbound-receiver.md** — Brief pattern (Worker → Queue → consumer → R2); keep as recipe.

8. **drizzle/d1-migration.md** — Straight-forward pattern (drizzle-kit generate/push); keep as recipe.

9. **email/graph-shared-mailbox.md** — Default for internal apps. HoopsLoop uses Resend (consumer SaaS); this pattern is net-new but straightforward (client credentials flow + ApplicationAccessPolicy). Keep as recipe.

10. **email/resend.md** — HoopsLoop pattern confirmed. Keep as recipe.

11. **email/cloudflare-email-service.md** — Public beta; keep as recipe. HoopsLoop doesn't use this.

12. **email/cloudflare-email-routing.md** — Inbound email; keep as recipe.

13. **email/react-email-editor.md** — @react-email/editor visual composer. HoopsLoop includes it in deps but doesn't show UI usage; keep as recipe (optional for apps with user-authored templates).

14. **teams/adaptive-card-alert.md** — Brief pattern; keep as recipe.

15. **teams/presence.md** — Brief pattern; keep as recipe.

16. **pagerduty/event-create.md** — Brief pattern; keep as recipe.

17. **cloudflare/workers-builds-setup.md** — Brief pattern (zero-config GitHub integration alternative); keep as recipe with note that quality gates still require GitHub Actions.

18. **cloudflare-tunnel/add-target.md** — Brief pattern; keep as recipe.

19. **autotask/ticket-create.md** — Brief pattern; keep as recipe.

**New recipes surfaced by survey:**

20. **ai/streaming-chat-route.md** — The SSE Content-Encoding: identity fix for Workers; needed because it's a gotcha. HoopsLoop doesn't show streaming use, but the template should document it.

21. **logging/pino-structured-logging.md** — Optional observability recipe; HoopsLoop uses Pino for JSON output. Nice-to-have for debugging production issues.

22. **testing/playwright-e2e.md** — Brief mentioned Playwright but it's not in HoopsLoop deps. Offer as optional recipe.

**Recipes to drop or reshape:**

- Stripe (HoopsLoop uses it; brief says drop—keep as recipe if web-scheduler needs payments, but out of scope for this template). No action needed.
- PostHog (HoopsLoop uses it; brief says drop—keep as optional observability recipe if useful). Skip from initial recipes; add if feedback warrants.
- Sentry (HoopsLoop uses it; brief says drop—keep as optional observability recipe). Skip from initial recipes.
- Zustand (HoopsLoop uses it; brief says drop—use React Context + Suspense instead). No action needed.
- next-themes (HoopsLoop uses it; brief says drop—replace with shadcn's built-in theme logic). Flag this in findings (see section 2).
- react-day-picker (HoopsLoop uses it; brief says drop). Skip from template; use input[type=date] or custom component.

---

## Open questions for Michael (resolved during Phase 1 review)

All five resolved; decisions are captured in the **Decisions locked** section near the top of this document. Summary for traceability:

1. **Observability defaults** — Resolved: Pino + health + env validation in template; Sentry / PostHog drop to recipes only.
2. **next-themes replacement** — Resolved: keep `next-themes` as the shadcn-canonical pattern. Reversed the earlier drop.
3. **Streaming SSE fix** — Resolved: ship a streaming chat route example in the template (with the `Content-Encoding: identity` fix in the handler).
4. **Durable Objects in template** — Resolved: removable example only.
5. **Remediation scripts scope** — Resolved: one hard gate (`openapi-contract`) + one soft gate (`intent:stale`). Other guards land in a recipe.

### Additional decisions reached during review (not in original survey)

6. **AI chat UI** — Vercel AI Elements, replacing assistant-ui from the brief.
7. **`react-day-picker`** — kept (rides along under shadcn `Calendar`/`DatePicker`); reverses the earlier drop.
8. **Agent governance structure** — neutral `agent-rules/` directory with AGENTS.md as the canonical entry; `CLAUDE.md` and `.cursorrules` are thin shims; `.claude/settings.json` carries harness-specific permissions and MCP preconfig.
9. **Discoverability + agent-ready surface** — robots.txt, sitemap, `.well-known/api-catalog`, `.well-known/oauth-protected-resource`, `.well-known/mcp-server-card` ship in the template (~100 lines).
10. **TanStack Intent** — install latest, full lifecycle scripts, `agent-rules/intent.md` carries cadence rules. Pre-1.0 dep accepted as additive (lookup-order still works without it).
11. **MCP harness preconfig** — Cloudflare Docs, Microsoft Learn, Context7 wired in `.claude/settings.json`.
12. **Dependency governance** — `agent-rules/dependencies.md` (latest stable, propose-and-confirm) plus permission gates that prompt on every dep change.
13. **Spec fidelity** — `agent-rules/spec-fidelity.md` requires reading the canonical spec before code and re-anchoring before architectural moves.
14. **Template repo name** — `template-cf-fullstack`.
15. **Recipes reorg** — domain-based tree (option c), reorg before new recipes are written.
16. **`email/react-email-editor.md`** — deferred; revisit when an app needs it.
17. **Auth provider abstraction** — `getCurrentUser(request)` in `src/lib/auth/` with provider-agnostic `User` shape (`id`, `email`, `name?`, `groups[]`); Better Auth default + Cloudflare Access recipe conform to the same interface. Tenant context lives in a separate `getActiveTenant()` and is not part of `User`. Dev-mode bypass lives in the provider implementation, not the dispatcher. HoopsLoop's `getSessionFn` is the working starting point at the server-function layer; the template lifts the abstraction one layer down for broader reach.
