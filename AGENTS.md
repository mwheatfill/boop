---
title: "AGENTS.md"
type: "Repo Instructions"
status: Active
author: "Michael Wheatfill, Cloud & Collaboration Architect"
description: "Canonical instructions for AI coding agents working in this repo. Cross-harness; read first."
---

# AGENTS.md

You're an AI coding agent (Claude Code, Codex, Cursor, Aider, or similar) working in a Cloudflare Workers + TanStack Start application built from `template-cf-fullstack`. This file is the canonical entry point for all agent work in this repo.

## Read order at session start

1. **This file (`AGENTS.md`)**
2. **The canonical spec** if one exists. Look for `SPEC.md`, `PRD.md`, or `docs/spec/*` in the repo root or `docs/`. If multiple candidates exist, ask which is canonical.
3. **`docs/adr/README.md`**: index of Architecture Decision Records. Skim titles to know what decisions exist. Read individual ADRs before contemplating overrides.
4. **`agent-rules/lookup-order.md`**: the doc-resolution protocol for everything else.
5. **Recent commits**: run `git log --oneline -20` for context on what's in flight.

## Stack snapshot

| Layer | Choice |
|---|---|
| Runtime | Cloudflare Workers (Wrangler 4, single `wrangler.jsonc` with `env.production` block; production builds set `CLOUDFLARE_ENV=production`) |
| Framework | TanStack Start (SSR + file-based routing + API routes) |
| Database | Cloudflare D1 + Drizzle ORM (empty schema by default; Neon Postgres available via recipe) |
| Auth | `getCurrentUser(request)` abstraction in `src/lib/auth/`; returns `null` until an auth recipe is installed (e.g. `auth/better-auth`, `auth/cloudflare-access`) |
| AI | Recipe-only. Install `ai/chat-route` + a provider recipe (e.g. `microsoft-foundry/chat-completion`); template ships nothing AI-related |
| Email | Recipe-only. Install `email/send-pipeline` + a transport recipe (e.g. `email/graph-shared-mailbox`); template ships nothing email-related |
| UI | shadcn/ui style `base-vega` (Base UI primitives via `@base-ui/react` + the "vega" visual theme), Tailwind v4, `next-themes` for theme provider |
| Validation | Zod + zod-openapi → generated `openapi.json` contract (CI-enforced) |
| Logging | Structured `console.*` via `@/lib/log` (Workers Logs auto-indexes JSON fields). Recipes overlay Sentry / App Insights / OTel. See [`agent-rules/observability.md`](agent-rules/observability.md) |
| Testing | Vitest + Testing Library |
| Tooling | Biome, Husky, lint-staged, Renovate, TanStack Intent |
| Node | ≥24.0.0, pnpm ≥11 |

Don't override these without reading the relevant ADR in `docs/adr/` and proposing a spec edit. See `agent-rules/spec-fidelity.md`.

## How agents work in this repo

The full rule set lives in `agent-rules/`. Each rule is a short, harness-agnostic markdown file. Read the relevant one before acting.

| Concern | Rule file | When to read |
|---|---|---|
| Doc resolution (current docs over training data) | `agent-rules/lookup-order.md` | Every session, before researching libraries |
| Opinionated stack: one canonical choice per concern | `agent-rules/preferences.md` | Before reaching for any library, primitive, or pattern |
| Adding / removing / pinning dependencies | `agent-rules/dependencies.md` | Before any `pnpm add`, `pnpm remove`, `pnpm update` |
| Re-anchoring on the spec | `agent-rules/spec-fidelity.md` | Session start, before architectural moves |
| Auth boundaries, data flow, validation | `agent-rules/architecture.md` | When touching server functions, auth, DB |
| OpenAPI contract discipline | `agent-rules/api-contract.md` | When adding or changing server functions |
| TanStack Intent cadence | `agent-rules/intent.md` | After dep changes, per-task on TanStack-area work |
| Naming, formatting, comments, voice | `agent-rules/conventions.md` | Always |
| Logging + error/analytics layering | `agent-rules/observability.md` | Before reaching for `console.*` or any monitoring SDK |
| Codex-specific harness setup | `agent-rules/codex-config.md` | Codex sessions only |

## Session protocol

**At session start:**

- Read this file.
- Read the spec (`SPEC.md`, `PRD.md`, etc.) if present.
- Run `git status` and `git log --oneline -20` to know the working state.
- Run `pnpm intent:list` to see available skill guidance for installed TanStack packages.
- Resolve documentation questions per `agent-rules/lookup-order.md`.

**Mid-session, before architectural moves:**

- Re-read the relevant section of the spec. Don't drift around it; propose spec edits if it's wrong.
- Read the relevant ADR in `docs/adr/` if you're contemplating overriding a foundational choice.
- For TanStack-area changes, run `npx @tanstack/intent load <package>#<skill>` to load current guidance for the installed version.

**At session end:**

- Surface what changed, what's tested, what's pending.
- Don't mark tasks complete unless verified.

## Locked decisions (don't override silently)

These have ADRs in `docs/adr/`. If you're tempted to deviate, read the ADR first, then propose a spec edit.

- Cloudflare Workers as the runtime ([ADR-0001](docs/adr/0001-cloudflare-workers-runtime.md))
- TanStack Start as the framework ([ADR-0002](docs/adr/0002-tanstack-start-framework.md))
- D1 default for the data layer; Neon via recipe ([ADR-0003](docs/adr/0003-d1-default-data-layer.md))
- Drizzle as the ORM ([ADR-0004](docs/adr/0004-drizzle-orm.md))
- Better Auth as the auth library, providers via env; Cloudflare Access via recipe ([ADR-0005](docs/adr/0005-better-auth-with-entra-default.md))
- AI SDK + AI Elements; AI provider via env, AI Gateway recommended for production ([ADR-0006](docs/adr/0006-foundry-via-ai-gateway.md))
- Auth provider abstraction (`getCurrentUser`) ([ADR-0007](docs/adr/0007-auth-provider-abstraction.md))
- Neutral agent governance (this file + `agent-rules/`) ([ADR-0008](docs/adr/0008-neutral-agent-governance.md))
- Discoverability surface in template (`.well-known/`, robots, sitemap, llms.txt) ([ADR-0009](docs/adr/0009-discoverability-in-template.md))
- TanStack Intent + MCP servers for documentation currency ([ADR-0010](docs/adr/0010-skill-currency-protocol.md))
- Opinionated stack with mechanical pattern enforcement ([ADR-0011](docs/adr/0011-opinionated-stack-and-pattern-enforcement.md))

## Things to avoid

- **Don't add dependencies without proposing.** See `agent-rules/dependencies.md`. The harness will prompt the user on `pnpm add`; this is intentional.
- **Don't write code that the OpenAPI contract doesn't describe.** Server functions take Zod-validated inputs that flow into `public/openapi.json`. The CI guard (`scripts/check-openapi-contract.ts`, run via `pnpm openapi:check`) blocks deploys when this drifts.
- **Don't bypass the auth abstraction.** All identity reads go through `getCurrentUser(request)`. Don't import Better Auth directly from route guards or server functions.
- **Don't import from `radix-ui` or `@radix-ui/*`.** The template uses Base UI primitives via `@base-ui/react` (style `base-vega`). For composition (the equivalent of Radix's `asChild` / `Slot`), use Base UI's `render` prop: `<Button render={<Link to="/x" />}>Label</Button>`. The audit (`pnpm audit:patterns`) blocks Radix imports.
- **Don't trust training data over current docs.** When library guidance from training conflicts with what `intent load`, an MCP server, or `llms.txt` says, the live source wins. Verify before writing.
- **Don't tack on rules; revise them.** When an existing rule almost-but-not-quite covered a case you hit, revise that rule. Don't add a near-duplicate elsewhere or append a caveat. The bar to add a *new* rule is "no existing rule, slightly tightened, would have prevented this." Apply the same principle to ADRs and to the spec.
- **Don't add comments that explain "what."** Code says what; comments say why, only when non-obvious.
- **Don't use em dashes in prose.** Repo voice convention. Use commas, parens, or split sentences.

## File naming and code conventions

- **kebab-case** for filenames.
- **PascalCase** for React components.
- **camelCase** for variables, functions, hooks (`useFoo`).
- **Active voice** in docs and comments. Oxford commas. Sentence-style headings.
- **Product names:** always "Microsoft 365" (never "M365"). Always "Microsoft Foundry" (never "Azure AI Foundry" or "Azure OpenAI" alone).

Full conventions in `agent-rules/conventions.md`.

## Compatibility notes

- `CLAUDE.md` is a thin shim pointing at this file. Older Claude Code versions look for `CLAUDE.md`; newer versions read `AGENTS.md` directly.
- `.cursorrules` is a thin shim pointing at this file with high-priority rules inlined for Cursor's fallback parsing.
- `.claude/settings.json` carries Claude Code-specific permission gates and MCP server preconfig. The Codex equivalent is documented in `agent-rules/codex-config.md`.

If you're an agent that reads neither `AGENTS.md` nor `CLAUDE.md` natively: read this file before doing anything else.
