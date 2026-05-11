---
name: audit-codebase
description: Comprehensive multi-domain best-practices audit of the codebase. Spawns parallel subagents per concern (runtime, framework, React, UI, data, validation+API, auth, security, code quality, docs), each research-first via current docs, then synthesizes a prioritized punch list. Optional argument scopes to one domain. Trigger when the user asks for a codebase audit, a best-practices sweep, or "audit the whole repo."
---

# audit-codebase

You are coordinating a comprehensive best-practices audit of this codebase. The goal: confirm the template (or app derived from it) is tight, clear, and free of bloat / workarounds / anti-patterns / stale practices, so every project derived from this codebase and every human or agent that reads the docs/code starts from an ideal baseline.

**Optional argument:** `$ARGUMENTS` — if a domain is named (e.g. `runtime`, `react`, `security`, `docs`), audit only that domain. Otherwise run the full sweep across all domains.

## Method

Spawn one **general-purpose** subagent per domain in **parallel** (single message, multiple Agent tool calls). Each subagent works in its own context window so the orchestrator (you) only sees the synthesized reports, not the raw file reads.

**Each subagent must:**

1. Read the target files for its domain.
2. **Research-first** the current best practices via the canonical sources (in order; first hit wins):
   - Project-local: `AGENTS.md`, `docs/adr/`.
   - TanStack Intent skills (TanStack libs): `npx @tanstack/intent load <pkg>#<skill>`.
   - Configured MCP servers (`.mcp.json`): `cloudflare-docs`, `microsoft-learn`, `context7`.
   - `https://<vendor>/llms.txt`.
   - Vendor official docs via WebFetch.
   - Web search only when (1)–(5) yield nothing.
3. **Cite a source URL or MCP query for every "best practice" claim.** Do not assert from training data; if no source exists, label the finding `NO-SOURCE` and flag it for user review.
4. Report findings in the structured format below.

## Output format (each subagent)

```
## Domain: <name>

### Findings

| Severity | File:line | Issue | Best practice | Source | Recommended fix |
|---|---|---|---|---|---|
| critical | path/to/file.ts:42 | <what's wrong> | <what current docs say> | <URL or MCP query> | <concrete change> |
| cleanup  | path/to/file.ts:120 | ... | ... | ... | ... |
| nice     | ... | ... | ... | ... | ... |

### Cross-cutting observations

- <pattern observed across multiple files>
- <bloat or duplication identified>

### Verified clean

- <areas inspected that follow best practices>
```

**Severity tiers:**

- **critical**: factually wrong, broken, security-risk, anti-pattern that would mislead derived apps.
- **cleanup**: works but bloated, duplicative, jargon-heavy, journaling, stale references.
- **nice**: tighter form possible; not load-bearing.

## Domains

Run all of these unless `$ARGUMENTS` names one. Each gets its own subagent.

### 1. `runtime` — Cloudflare Workers + CI/deploy

Files: `wrangler.jsonc`, `.github/workflows/*`, `package.json` scripts, `vite.config.ts`.

Check against Cloudflare Workers docs and the TanStack Start framework guide (use the `cloudflare-docs` MCP):
- `wrangler.jsonc` shape (single file with `env.production` block, non-inheritable bindings declared in each env block, observability enabled).
- Deploy uses `cloudflare/wrangler-action@v3` (canonical) and not raw `pnpm exec wrangler deploy`.
- Build + deploy in same job (so `.wrangler/deploy/config.json` is local), OR cross-job artifact passes `dist/` AND `.wrangler/deploy/config.json` together.
- No workaround flags: no `--config dist/server/wrangler.json`, no `--env=""`.
- D1 migrations apply via `wrangler d1 migrations apply` with `--env production` for prod.
- Env vars read via `import { env } from 'cloudflare:workers'` inside server code, not `process.env`.
- Secrets: `.dev.vars` for local, `wrangler secret put` for prod, never committed.

### 2. `framework` — TanStack Start + Router + server functions

Files: `src/routes/**/*`, `src/router.tsx` or equivalent, `routeTree.gen.ts` (don't read; just verify it's gitignored or only-Bot-edited).

Check via TanStack Intent skills (`pnpm intent:list`, then `npx @tanstack/intent load @tanstack/react-router#routing`, `... @tanstack/react-start#server-functions`):
- Router uses `createRootRouteWithContext<MyRouterContext>()`, never bare `createRootRoute`.
- File-based routing with the canonical naming (`__root.tsx`, `_pathlessLayout.tsx`, `posts.$postId.tsx`, `(app)/dashboard.tsx`, `[.]well-known/...`).
- Server functions use `createServerFn({ method }).inputValidator((data) => schema.parse(data)).handler(...)`. No no-op validators (the audit catches this; verify it's clean).
- Loaders prefetch via `context.queryClient.ensureQueryData(opts)`; components consume via `useSuspenseQuery(opts)` with the same `queryOptions` factory.
- Server functions colocated with single-route consumers; in `src/server/<feature>.ts` when shared.
- Auth-aware routes use `beforeLoad` to gate.

### 3. `react` — React 19 patterns

Files: `src/routes/**/*.tsx`, `src/components/**/*.tsx`.

Check against React 19 docs (use `context7` MCP for `react`):
- Ref-as-prop, no `forwardRef`. Props typed with `ref?: Ref<HTMLElement>`.
- No `displayName` on function components.
- No `<Context.Provider>`. React 19 supports `<MyContext value={x}>` directly.
- Forms use `<form action={fn}>` + `useActionState` (or TanStack Form for rich forms). Avoid manual `onSubmit` + `useState` chains.
- Document metadata via React 19 native tags or framework `head()`. No `react-helmet`.

### 4. `ui` — shadcn (base-vega), Tailwind v4, Base UI

Files: `src/components/**/*.tsx`, `src/styles/app.css`, `components.json`, `tailwind.config.*` (should NOT exist for Tailwind v4).

Check via `https://ui.shadcn.com/llms.txt` and shadcn docs:
- `components.json` declares `style: "base-vega"`, `baseColor: "neutral"`, `iconLibrary: "lucide"`. Sticky after init.
- shadcn primitives in `src/components/ui/` were installed by `npx shadcn@latest add <name>`, not hand-rolled.
- `data-slot` attributes preserved (load-bearing for canonical CSS selectors).
- Composition uses Base UI's `render` prop, not Radix's `asChild` / `Slot`. The audit blocks Radix imports.
- Class merging via `cn()` from `@/lib/utils`, not bare `clsx` or template literals.
- Tailwind v4: no `tailwind.config.{js,ts}`; config lives in `app.css` via `@theme`. OKLCH color tokens. `@custom-variant dark (&:where(.dark, .dark *))` for dark mode.
- shadcn Chart colors flow via `var(--color-<key>)` (no `hsl()` wrapper, no hex literals).

### 5. `data` — D1 + Drizzle + Auth abstraction

Files: `src/lib/db/*`, `src/lib/auth/*`, `drizzle/**`, `src/shared/schemas/auth.ts`.

Check via Drizzle docs and ADR-005 (auth abstraction):
- DB factory in `src/lib/db/client.ts` is request-scoped: `createDb(env.DB)`, called inside server functions with `import { env } from 'cloudflare:workers'`.
- Migrations in `drizzle/` are SQL files generated by `drizzle-kit generate`; never `drizzle-kit push` against prod.
- All identity reads go through `getCurrentUser(request)`. Verify no direct imports of `better-auth`, `jose`, etc., outside `src/lib/auth/`.
- `User` shape is identity-only (id/email/name/image/groups). No tenant fields.
- The Zod schema in `src/shared/schemas/auth.ts` is the single source for both `openapi.json` and the `User` type (`z.infer<typeof UserSchema>`).

### 6. `validation-api` — Zod + zod-openapi + OpenAPI contract

Files: `src/shared/schemas/**`, `src/routes/**/*.ts(x)` (server functions), `public/openapi.json`, `scripts/openapi-document.ts`, `scripts/check-openapi-contract.ts`.

Check against ADR-013 and zod docs:
- Schemas imported from `@/shared/schemas/openapi` (the type-augmentation seam for zod-openapi 5.x), not directly from `zod`.
- Schemas decorated with `.meta({ description, example, id })` per zod-openapi 5.x. No `.openapi()` (older syntax).
- Schemas live in `src/shared/schemas/<domain>.ts`; no ad-hoc inline schemas in route files.
- Server function `.inputValidator((data) => schema.parse(data))` is real validation, not a pass-through.
- `public/openapi.json` is committed, regenerated via `pnpm openapi:generate`, CI guard via `pnpm openapi:check`.

### 7. `security` — secrets, input, injection, headers

Files: full source; spec-relevant: `src/routes/api/**`, `src/lib/auth/*`, `wrangler.jsonc`, env handling.

Run an OWASP-relevant pass (no specific MCP; check against OWASP Top 10 via WebFetch if needed):
- Secrets: nothing committed; `.dev.vars` is gitignored; `wrangler secret put` for prod.
- Input validation at every server function boundary (Zod parse).
- No raw SQL with string interpolation (Drizzle parameterizes; flag any `db.execute(\`SELECT ...\`)` style).
- XSS: dynamic content rendered via React JSX (auto-escapes); Biome's `noDangerouslySetInnerHtml` blocks the obvious cases; flag any sanitized-then-injected paths.
- CSRF: Better Auth handles it; flag any custom mutation endpoints that don't.
- Auth: every protected endpoint calls `getCurrentUser` and throws on null at the edge. No deeper-buried checks.
- Response headers: `_headers` for static; security headers (CSP, X-Frame-Options, etc.) for dynamic responses where needed.
- No `eval`, no `new Function(...)`, no prototype mutation. Biome's `noGlobalEval` covers most.

### 8. `code-quality` — anti-patterns, smells, naming, comments

Files: `src/**/*.ts(x)`, `scripts/**/*.ts`.

Check against `AGENTS.md` "File naming" + "Things to avoid" + general senior-engineer practice:
- Naming: kebab-case files, PascalCase components, camelCase fns/vars/hooks, CONSTANT_CASE for env.
- Comments: no "what" comments, no multi-line docstrings, no ticket-reference comments. Comments only where the *why* is non-obvious.
- No em dashes in prose (markdown + comments).
- No journaling / past-failure confessions ("an earlier iteration", "moved out of X into Y", "we used to").
- No dead code, no unused exports, no half-finished implementations.
- TypeScript: strict mode honored; no `any` without a comment explaining why; no `as` casts outside boundaries; `import type` for type-only imports.
- Imports: `@/` alias for `src/`, no deep relative paths (`../../../../`).
- Error handling: throw don't return errors; no silent fallbacks; no `try { ... } catch { /* swallow */ }`.

### 9. `docs` — AGENTS.md, ADRs, README, recipe-link integrity

Files: `AGENTS.md`, `CLAUDE.md`, `README.md`, `docs/adr/*`.

Check against the practices established in this template (Anthropic best practices for CLAUDE.md, the agents.md convention):
- `AGENTS.md` is concise (target <100 lines). Anything Claude can figure out from code → cut.
- `CLAUDE.md` is one line: `@AGENTS.md`.
- ADRs follow `docs/adr/000-template.md` (no frontmatter, status pills, three sections: Context / Decision / Consequences).
- ADR Context sections describe the specific situation for that decision, not generic doc-class meta.
- No undefined jargon (e.g., "pin" used without definition; "tier-1" / "concern group" leaked from internal vocabulary).
- No journaling / past-failure narration in any doc.
- All cross-references resolve (no dangling links to deleted files).
- README clearly explains: what the template is, what's in/out of the box, quick start, deploy, where to find more.

## Synthesis (orchestrator role)

After all subagents return, you (the main session) consolidate:

1. **Deduplicate** findings that span multiple domains (e.g., a `console.*` direct call might be flagged by both `code-quality` and `docs`).
2. **Group by severity**, then by domain within each severity.
3. **Surface "the top 5 things to fix first"** at the top of the synthesis. These are the highest-leverage items.
4. **Flag any `NO-SOURCE` findings** for user review separately. These are claims the subagents could not back with current docs.
5. **Note "verified clean" areas** in a brief summary so the user knows what's confirmed solid.

Output the synthesis in markdown with clear severity sections and clickable file:line references.

## When to stop

- If a subagent fails (MCP outage, file not found, etc.), it returns a partial report flagging what it couldn't check. Don't block the synthesis on a single failure.
- If `$ARGUMENTS` was a domain name and that domain is clean, return a brief "no findings" report rather than fabricating concerns.

## What this skill does NOT do

- It does not auto-fix anything. Findings are reported; the user decides what to apply.
- It does not run `pnpm test`, `pnpm build`, or other build gates. Those are separate (see CI).
- It does not check recipes in the consuming app (those have their own READMEs); audit only the template/app code itself.
