<!-- intent-skills:start -->
## Skill Loading

Before substantial work:
- Skill check: run `pnpm dlx @tanstack/intent@latest list`, or use skills already listed in context.
- Skill guidance: if one local skill clearly matches the task, run `pnpm dlx @tanstack/intent@latest load <package>#<skill>` and follow the returned `SKILL.md`.
- Monorepos: when working across packages, run the skill check from the workspace root and prefer the local skill for the package being changed.
- Multiple matches: prefer the most specific local skill for the package or concern you are changing; load additional skills only when the task spans multiple packages or concerns.
<!-- intent-skills:end -->

# AGENTS.md

You're an AI coding agent (Claude Code, Codex, Cursor, Aider, or similar) working in a Cloudflare Workers + TanStack Start application built from `boop`. This file is the canonical entry point. Read it first.

At session start: skim [`docs/adr/README.md`](docs/adr/README.md) for the architectural decisions, [`CONTEXT.md`](CONTEXT.md) for the domain language, and [`DESIGN.md`](DESIGN.md) for the interface rules. Read whatever spec exists (`SPEC.md`, `PRD.md`, `docs/spec/*`). Run `git log --oneline -20` for in-flight context. Doc resolution for libraries is handled by the research-first protocol re-anchored every turn via the `UserPromptSubmit` hook in [`.claude/hooks/`](.claude/hooks/).

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
| Validation | Zod 4 imported from `@/shared/schemas/openapi` (the type-augmentation seam for zod-openapi 5.x); `openapi.json` is the CI-enforced contract |
| Logging | `logInfo` / `logWarn` / `logError` from `@/lib/log` (a `console.*` wrapper; Workers Logs auto-indexes JSON fields). Recipes overlay Sentry / App Insights / OTel without touching call sites |
| Testing | Vitest + Testing Library |
| Tooling | Biome, Husky, lint-staged, Renovate, TanStack Intent |
| Node | ≥24.0.0, pnpm ≥11 |

Don't override these without reading the relevant ADR.

## Doc resolution

When researching libraries, APIs, or vendor services, resolve in this order before falling back to training data:

1. Project-local: `docs/adr/`, this file.
2. TanStack Intent skills (for TanStack libs): `npx @tanstack/intent load <pkg>#<skill>`.
3. MCP servers from [`.mcp.json`](.mcp.json): `cloudflare-docs`, `microsoft-learn`, `context7`.
4. `https://<vendor>/llms.txt`.
5. Vendor official docs via WebFetch.
6. Web search.
7. Training data (last resort; verify against 2–5).

The `UserPromptSubmit` hook re-anchors this every turn.

## Locked decisions

ADRs in `docs/adr/`. Read the ADR before contemplating an override; deviations require a new ADR plus an audit-allowlist edit.

- Cloudflare Workers as the runtime ([ADR-001](docs/adr/001-cloudflare-workers-runtime.md))
- TanStack Start as the framework ([ADR-002](docs/adr/002-tanstack-start-framework.md))
- D1 default for the data layer; Neon via recipe ([ADR-003](docs/adr/003-d1-default-data-layer.md))
- Drizzle as the ORM ([ADR-004](docs/adr/004-drizzle-orm.md))
- Auth provider abstraction (`getCurrentUser`) ([ADR-005](docs/adr/005-auth-provider-abstraction.md))
- Better Auth as the default auth recipe ([ADR-006](docs/adr/006-better-auth-with-entra-default.md))
- AI is recipe-only; AI SDK + AI Gateway ([ADR-007](docs/adr/007-foundry-via-ai-gateway.md))
- UI / visual layer (shadcn-base-vega centered) ([ADR-008](docs/adr/008-ui-visual-layer.md))
- Opinionated stack with mechanical pattern enforcement ([ADR-009](docs/adr/009-opinionated-stack-and-pattern-enforcement.md))
- Neutral agent governance ([ADR-010](docs/adr/010-neutral-agent-governance.md))
- Skill currency protocol (Intent + MCP) ([ADR-011](docs/adr/011-skill-currency-protocol.md))
- Discoverability surface in template ([ADR-012](docs/adr/012-discoverability-in-template.md))
- Forms + validation (TanStack Form, React 19 actions, Zod) ([ADR-013](docs/adr/013-forms-and-validation.md))
- Cron parser, date/time approach, timezone on the data model ([ADR-017](docs/adr/017-cron-and-time.md))
- Current-by-default for third-party version pins ([ADR-020](docs/adr/020-current-by-default-third-party-pins.md))
- Design language pass 2: dark-first, three-anchor theme, cool-blue UI accent ([ADR-022](docs/adr/022-design-language-pass-2.md))

## Agent skills

### Issue tracker

GitHub Issues on [`mwheatfill/boop`](https://github.com/mwheatfill/boop) via the `gh` CLI. See [`docs/agents/issue-tracker.md`](docs/agents/issue-tracker.md).

### Triage labels

Canonical roles (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`) map 1:1 to GitHub labels. See [`docs/agents/triage-labels.md`](docs/agents/triage-labels.md).

### Domain docs

Single-context: one `CONTEXT.md` and one `docs/adr/` at the repo root. See [`docs/agents/domain.md`](docs/agents/domain.md).

## Things to avoid

- **Don't add dependencies casually.** Propose `<package>@<version>`, why, alternatives considered, maintenance signal in the PR description or commit body. The harness allows `pnpm add`; the protection is the `pnpm-lock.yaml` diff in PR review.
- **Don't pin stale majors of third-party versions.** GitHub Actions, npm deps, wrangler/cloudflare action pins, MCP server pins, shadcn registry style. Resolve current latest before pinning: `gh api repos/<owner>/<repo>/releases/latest` for Actions, the package registry for npm, the vendor's release feed otherwise. Renovate keeps in-repo pins fresh once installed; `pnpm audit:patterns` catches drift in CI. See ADR-020.
- **Don't write code that the OpenAPI contract doesn't describe.** Server functions take Zod-validated inputs that flow into `public/openapi.json`. The CI guard (`pnpm openapi:check`) blocks deploys on drift.
- **Don't bypass the auth abstraction.** All identity reads go through `getCurrentUser(request)`. Don't import an auth library directly from route guards or server functions.
- **Don't import from `radix-ui` or `@radix-ui/*`.** UI uses Base UI (`@base-ui/react`, style `base-vega`). For composition, use Base UI's `render` prop: `<Button render={<Link to="/x" />}>Label</Button>`. The audit (`pnpm audit:patterns`) blocks Radix imports.
- **Don't add comments that explain "what."** Code says what; comments say why, only when non-obvious.
- **Don't use em dashes in prose.** Use commas, parens, or split sentences.
- **Don't narrate past failures or transitions in docs.** State the current decision and rationale; the journey lives in `git log`.

## File naming

- **kebab-case** for filenames (`get-current-user.ts`).
- **PascalCase** for React component files (`Button.tsx`).
- **camelCase** for variables, functions, hooks (`useFoo`).
- **CONSTANT_CASE** for env vars and runtime constants.
- **Product names:** "Microsoft 365" (never "M365"), "Microsoft Foundry" (never "Azure AI Foundry" or "Azure OpenAI" alone).

## Compatibility notes

- `CLAUDE.md` is a one-line `@AGENTS.md` import. Claude Code only reads `CLAUDE.md` natively; the import loads this file at session start. Per [Anthropic's memory docs](https://code.claude.com/docs/en/memory).
- `.cursorrules` is a thin shim with high-priority rules inlined for Cursor's fallback parsing.
- `.claude/settings.json` carries Claude Code permission gates and hook wiring. MCP servers are in `.mcp.json` (portable across harnesses that read it).
