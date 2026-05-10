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

- Auth providers: `auth/better-auth` (default), planned `auth/cloudflare-access`
- AI features: `ai/chat-route`, `ai/chat-ui`, plus a provider recipe (Microsoft Foundry today; planned Workers AI, Anthropic, OpenAI)
- Email: `email/send-pipeline` plus per-transport recipes (`email/graph-shared-mailbox` today; planned Resend, Cloudflare Email Service)
- MCP server: `mcp/expose-app-as-mcp-server`
- Postgres swap: planned `data-layer/switch-to-neon-postgres`
- See the [recipes repo](https://github.com/mwheatfill/app-platform-recipes) for the full list

## Quick start

```bash
# 1. Clone via "Use this template" on GitHub or
#    git clone https://github.com/<owner>/<your-app>.git

# 2. Install + bootstrap. The bootstrap script does an interactive app
#    rename across 9 files (wrangler configs, package.json, README.md,
#    AGENTS.md, etc.), generates .dev.vars from the example, installs
#    TanStack Intent skill bindings, verifies openapi.json is in sync,
#    and offers to create your own dev/prod D1 databases.
pnpm install
pnpm bootstrap

# 3. Run locally
pnpm dev
```

Then open `http://localhost:3000`.

## Deploy

GitHub Actions handles deploys. Two workflows in [`.github/workflows/`](.github/workflows/):

- **`main.yml`**: runs on every PR (check job only) and on push to `main` (check + deploy-dev). The `deploy-dev` job depends on `check` passing and downloads the `dist/` artifact the check job uploaded, so it deploys exactly what passed the gates instead of rebuilding.
- **`deploy-production.yml`**: a git tag matching `v*.*.*` deploys to the `production` Cloudflare environment after running its own quality gates on the tagged SHA.

Both workflows share their setup (checkout, pnpm, Node, install) through a composite action at [`.github/actions/setup`](.github/actions/setup/action.yml). Update the install pipeline in one place.

Quality gates: Biome lint/format, build, vitest, `openapi:check`. `intent:stale` runs as a soft warning on the check job. Migrations run via `pnpm exec wrangler d1 migrations apply` against the target env before deploy.

### Required GitHub Secrets

Configure under **Settings → Secrets and variables → Actions** before the first push to `main`:

| Secret | Where to get it |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Create at <https://dash.cloudflare.com/profile/api-tokens> with the **Edit Cloudflare Workers** template (Workers Scripts: Edit, D1: Edit, Account Analytics: Read). |
| `CLOUDFLARE_ACCOUNT_ID` | Find in the Cloudflare dashboard sidebar under your account name. |

Both are referenced as job-level `env:` so wrangler picks them up automatically. Configure GitHub Environments named `dev` and `production` if you want per-environment review gates or distinct secrets.

### Per-environment wrangler config

The template uses the canonical Cloudflare multi-env pattern: one `wrangler.jsonc` with the dev settings at the top level and a single `env.production` block for prod overrides. The Cloudflare Vite plugin reads `wrangler.jsonc` and selects which environment to flatten into `dist/server/wrangler.json` based on the `CLOUDFLARE_ENV` environment variable.

```bash
# Dev (default; no env var needed)
pnpm build                              # top-level config wins
pnpm dev                                # ditto

# Production
CLOUDFLARE_ENV=production pnpm build    # env.production block wins
```

The Cloudflare Vite plugin flattens the wrangler config into `dist/server/wrangler.json` based on `CLOUDFLARE_ENV`. This is the canonical multi-env pattern from Cloudflare; `wrangler deploy` reads the dist version directly with no flag needed.

Some non-obvious bits:

- **Bindings (`vars`, `d1_databases`, etc.) are non-inheritable.** The `env.production` block must redefine them in full, even when the values mostly match the top level. Compatibility date, compatibility flags, `main`, and `observability` *are* inheritable.
- **Worker names:** the env.production block sets its own explicit `name` (`template-cf-fullstack-prod`) instead of relying on the `<top>-<env>` auto-suffix. That keeps the prod worker named `-prod` rather than the awkward `template-cf-fullstack-dev-production` that auto-suffixing would produce on top of an already-suffixed top-level name.
- **`wrangler deploy`** reads `dist/server/wrangler.json` directly. No flag needed because the plugin already wrote the right env into the dist config at build time.
- **`wrangler d1 migrations apply`** reads `wrangler.jsonc` directly, not the dist version, so it needs `--env production` when applying to prod. Dev is the top-level config and needs no flag.

## Recipes

Capabilities install via the recipes repo. Once an interactive composer ships you'll be able to walk through recipe selection from `pnpm bootstrap`. Until then:

```bash
curl -sSL https://raw.githubusercontent.com/mwheatfill/app-platform-recipes/main/install.sh | bash -s -- <recipe-name>
```

## Agent-friendly by design

This template is built to be evolved by AI coding agents (Claude Code, Codex, Cursor, Aider):

- **[`AGENTS.md`](AGENTS.md)** is the canonical entry point. Codex, Cursor, and Aider read it natively; Claude Code loads it via the one-line `@AGENTS.md` import in `CLAUDE.md`.
- **[`.claude/hooks/`](.claude/hooks/)** holds deterministic enforcement (the research-first protocol re-anchored every turn).
- **[`.claude/settings.json`](.claude/settings.json)** carries Claude Code permission gates and hook wiring.
- **[`.mcp.json`](.mcp.json)** preconfigures MCP servers (Cloudflare Docs, Microsoft Learn, Context7) portably across harnesses.
- **[TanStack Intent](https://tanstack.com/intent)** is wired so in-tree library guidance stays version-locked to installed packages.

## Documentation

- [`AGENTS.md`](AGENTS.md): canonical agent instructions (stack, locked decisions, doc resolution, file naming, things to avoid)
- [`docs/adr/`](docs/adr/): Architecture Decision Records (why each major choice)
- [`docs/roadmap.md`](docs/roadmap.md): open work and milestones

## License

UNLICENSED. See [`LICENSE`](LICENSE).
