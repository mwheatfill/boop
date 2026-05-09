---
title: "template-cf-fullstack"
type: "Template"
status: Active
author: "Michael Wheatfill, Cloud & Collaboration Architect"
description: "Cloudflare Workers + TanStack Start template with AI, modern auth, and agent-ready governance baked in."
---

# template-cf-fullstack

Starter for great apps on Cloudflare. TanStack Start for the framework, D1 + Drizzle for data, Better Auth for identity (consumer or enterprise), AI SDK + AI Elements for AI features, and an agent-ready governance layer so AI coding agents work effectively in apps cloned from this template.

## What's in the box

| Layer | Choice |
|---|---|
| Runtime | Cloudflare Workers |
| Framework | TanStack Start (SSR + API routes) |
| Routing | TanStack Router (file-based) |
| Data | TanStack Query + Form + Table + Virtual |
| Database | Cloudflare D1 (Drizzle ORM) — Neon Postgres available via [recipe](https://github.com/mwheatfill/app-platform-recipes/tree/main/recipes/data-layer) |
| Auth | Better Auth with email+password, email-OTP, social OAuth, and Entra OIDC all wired (active providers via env). All identity reads through a `getCurrentUser()` abstraction |
| AI | Vercel AI SDK + AI Elements (shadcn-style chat UI), provider via env (Cloudflare Workers AI / Foundry / Anthropic / OpenAI), recommended pattern: AI Gateway-fronted |
| Email | React Email 6 templates, transport via env (Resend / Microsoft Graph / Cloudflare Email Service) |
| UI | shadcn/ui with base-ui primitives, Tailwind v4, `next-themes` |
| Validation | Zod + zod-openapi (single-source `openapi.json` contract) |
| Testing | Vitest + Testing Library |
| Tooling | Biome (format + lint), Husky + lint-staged, Renovate |

See [`docs/adr/`](docs/adr/) for the rationale behind each choice.

## Quick start

```bash
# 1. Clone via "Use this template" on GitHub or
#    git clone https://github.com/<owner>/<your-app>.git

# 2. Install + bootstrap (creates D1, generates .dev.vars from example, runs migrations,
#    installs TanStack Intent skill bindings)
pnpm install
pnpm bootstrap

# 3. Run locally
pnpm dev
```

Then open `http://localhost:3000`.

## Deploy

GitHub Actions handles deploys. Two workflows ship in [`.github/workflows/`](.github/workflows/):

- **`deploy-dev.yml`** — push to `main` → deploys to the `dev` Cloudflare environment
- **`deploy-production.yml`** — git tag matching `v*.*.*` → deploys to the `production` Cloudflare environment

Both run quality gates (Biome, build, type check, `openapi-contract` guard, `intent:stale` soft warning) before `wrangler deploy`. Migrations run via `drizzle-kit migrate` in CI before deploy.

For first-time setup, see the bootstrap script comments in [`scripts/bootstrap.sh`](scripts/bootstrap.sh) — Cloudflare account configuration (account ID + API token in GitHub Secrets) is the only manual step.

## Recipes

Optional capabilities live in the [recipes repo](https://github.com/mwheatfill/app-platform-recipes). Install one with:

```bash
curl -sSL https://raw.githubusercontent.com/mwheatfill/app-platform-recipes/main/install.sh | bash -s -- <recipe-name>
```

Common starting recipes:

- `data-layer/switch-to-neon-postgres` — swap D1 for Neon + Hyperdrive when the app needs Postgres-only features or scale
- `auth/swap-better-auth-for-cloudflare-access` — swap Better Auth for Cloudflare Access when the app fronts behind Access
- `microsoft-foundry/chat-completion` — production AI Gateway setup against Microsoft Foundry
- `cloudflare-workers-ai/setup` — Cloudflare-native AI provider, no external API key
- `mcp/expose-app-as-mcp-server` — make the app callable by AI agents over MCP
- `email/graph-shared-mailbox` — send mail via Microsoft Graph from a shared mailbox

## Agent-friendly by design

This template is built to be evolved by AI coding agents (Claude Code, Codex, Cursor, Aider). The governance layer:

- **[`AGENTS.md`](AGENTS.md)** is the canonical entry point. Every agent harness should read this first.
- **[`agent-rules/`](agent-rules/)** holds harness-agnostic markdown rules: dependency policy, spec fidelity, lookup order, conventions, etc.
- **[`.claude/settings.json`](.claude/settings.json)** carries Claude Code-specific permissions and pre-configured MCP servers (Cloudflare Docs, Microsoft Learn, Context7) so agents reference current documentation, not training-data snapshots.
- **[TanStack Intent](https://tanstack.com/intent)** is wired up so in-tree library guidance stays version-locked to installed packages.

If you're using a different agent harness, the rules in `agent-rules/` apply unchanged; only the gate layer differs. See [`agent-rules/codex-config.md`](agent-rules/codex-config.md) for the Codex equivalent.

## Documentation

- [`AGENTS.md`](AGENTS.md) — agent onboarding, session protocol, stack snapshot
- [`agent-rules/`](agent-rules/) — governance rules (cross-harness)
- [`docs/adr/`](docs/adr/) — Architecture Decision Records (why each major choice)

## License

UNLICENSED. See [`LICENSE`](LICENSE).
