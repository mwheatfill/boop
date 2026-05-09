---
title: "template-cf-fullstack"
type: "Template"
status: Active
author: "Michael Wheatfill, Cloud & Collaboration Architect"
description: "Cloudflare Workers + TanStack Start template. Skeleton plus agent-ready governance; capabilities (auth, AI, email, MCP, more) layer on via recipes."
---

# template-cf-fullstack

Starter for great apps on Cloudflare. Ships only what every app needs: framework wiring, an empty data layer, an agent-ready governance layer, and the build/deploy infrastructure. Capabilities (auth, AI, email, MCP, more) install on demand via [app-platform-recipes](https://github.com/mwheatfill/app-platform-recipes).

This split is deliberate. Templates that ship every feature pre-wired accumulate dead code, security holes, and surface area apps don't need. Templates that ship only the universal parts stay tight; recipes own per-capability concerns end-to-end (auth, validation, tests).

## What's in the box

| Layer | Choice |
|---|---|
| Runtime | Cloudflare Workers |
| Framework | TanStack Start (SSR + API routes) |
| Routing | TanStack Router (file-based) |
| Data | Cloudflare D1 + Drizzle ORM (schema is empty until you or a recipe adds tables) |
| Auth abstraction | `getCurrentUser(request)` shape; provider stubs to null until an auth recipe is installed |
| API contract | Zod + zod-openapi → generated `openapi.json` (empty until you add endpoints) |
| UI | Tailwind v4, `next-themes`, theme toggle, error / not-found components |
| Tooling | Biome (format + lint), Husky + lint-staged, TanStack Intent |

See [`docs/adr/`](docs/adr/) for the rationale behind each choice.

## What's not in the box (install via recipes)

- Auth providers — `auth/better-auth` (default), `auth/cloudflare-access`
- AI features — `ai/chat-route`, `ai/chat-ui`, provider recipes (Foundry, Workers AI, Anthropic, OpenAI)
- Email — `email/send-pipeline` plus per-transport recipes (Resend, Microsoft Graph, Cloudflare Email Service)
- MCP server — `mcp/expose-app-as-mcp-server`
- Postgres swap — `data-layer/switch-to-neon-postgres`
- See the [recipes repo](https://github.com/mwheatfill/app-platform-recipes) for the full list

## Quick start

```bash
# 1. Clone via "Use this template" on GitHub or
#    git clone https://github.com/<owner>/<your-app>.git

# 2. Install + bootstrap (creates D1, generates .dev.vars from example,
#    installs TanStack Intent skill bindings)
pnpm install
pnpm bootstrap

# 3. Run locally
pnpm dev
```

Then open `http://localhost:3000`.

## Deploy

GitHub Actions handles deploys (lands in M5). Two workflows in [`.github/workflows/`](.github/workflows/):

- **`deploy-dev.yml`** — push to `main` → deploys to the `dev` Cloudflare environment
- **`deploy-production.yml`** — git tag matching `v*.*.*` → deploys to the `production` Cloudflare environment

Both run quality gates (Biome, build, type check, `openapi:check` guard) before `wrangler deploy`. Migrations run via `wrangler d1 migrations apply` in CI before deploy.

## Recipes

Capabilities install via the recipes repo. Once an interactive composer ships you'll be able to walk through recipe selection from `pnpm bootstrap`. Until then:

```bash
curl -sSL https://raw.githubusercontent.com/mwheatfill/app-platform-recipes/main/install.sh | bash -s -- <recipe-name>
```

## Agent-friendly by design

This template is built to be evolved by AI coding agents (Claude Code, Codex, Cursor, Aider):

- **[`AGENTS.md`](AGENTS.md)** is the canonical entry point. Every agent harness should read this first.
- **[`agent-rules/`](agent-rules/)** holds harness-agnostic markdown rules: dependency policy, spec fidelity, lookup order, conventions.
- **[`.claude/settings.json`](.claude/settings.json)** carries Claude Code-specific permissions and pre-configured MCP servers (Cloudflare Docs, Microsoft Learn, Context7) so agents reference current documentation, not training-data snapshots.
- **[TanStack Intent](https://tanstack.com/intent)** is wired so in-tree library guidance stays version-locked to installed packages.

If you're using a different agent harness, the rules in `agent-rules/` apply unchanged; only the gate layer differs. See [`agent-rules/codex-config.md`](agent-rules/codex-config.md) for the Codex equivalent.

## Documentation

- [`AGENTS.md`](AGENTS.md) — agent onboarding, session protocol, stack snapshot
- [`agent-rules/`](agent-rules/) — governance rules (cross-harness)
- [`docs/adr/`](docs/adr/) — Architecture Decision Records (why each major choice)

## License

UNLICENSED. See [`LICENSE`](LICENSE).
