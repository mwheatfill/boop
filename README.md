# boop

A scheduler that fires HTTP requests on a schedule or webhook trigger against any reachable endpoint (public internet, or internal services via Cloudflare Tunnel), with AI-native authoring through Microsoft Foundry and alerting fan-out to Teams, PagerDuty, and Autotask.

boop runs as a Cloudflare Worker behind Cloudflare Access. Operators sign in with Entra SSO, define Jobs that fire HTTP requests against Targets on a schedule or webhook, and get alerted through their existing tools when Runs fail.

## What it does

- **Jobs, Runs, Attempts.** A Job fires HTTP requests against one Target on a Trigger (a time-based Schedule or an inbound webhook). Each firing is a Run; retries are Attempts. Request and response bodies stream to R2; recent history stays hot in D1.
- **Schedules without cron literacy.** Operators express cadence as a preset, an interval, an advanced cron expression, or natural language; boop resolves it and previews the next fire times before saving.
- **Public and private Targets.** A Target is a reusable HTTP destination. Public Targets carry their own URL; private Targets reach on-prem services through a provider-managed Cloudflare Tunnel, with derived health.
- **Alerting fan-out.** Channels (Teams, PagerDuty, Autotask, email, generic webhook) plus AlertRules decide when a terminal Run alerts and where it goes.
- **AI authoring.** Operators draft Jobs in natural language via Microsoft Foundry. The assistant never mutates state directly; it returns a typed Draft the operator confirms.
- **Recycle bin, Job templates, and runbook narration** round out day-to-day operation.

See [`CONTEXT.md`](CONTEXT.md) for the domain glossary and [`docs/adr/`](docs/adr/) for the decisions behind each choice.

## Stack

| Layer | Choice |
|---|---|
| Runtime | Cloudflare Workers (Wrangler 4; `boop-dev` / `boop-prod` from one `wrangler.jsonc`) |
| Framework | TanStack Start (SSR + file-based routing + server functions) |
| Data | Cloudflare D1 + Drizzle ORM |
| Auth | Cloudflare Access fronted by Entra OIDC, JWT validated in-Worker ([ADR-026](docs/adr/026-cloudflare-access-with-entra-oidc.md)) |
| API contract | Zod + zod-openapi generating [`public/openapi.json`](public/openapi.json), CI-enforced |
| UI | shadcn (`base-vega`) on Base UI, Tailwind v4, `next-themes` |
| AI | Microsoft Foundry via Cloudflare AI Gateway ([ADR-007](docs/adr/007-foundry-via-ai-gateway.md)) |
| Alerting | Teams, PagerDuty, Autotask, email (Graph shared mailbox), generic webhook |
| Tooling | Biome, Husky + lint-staged, Renovate, TanStack Intent, Vitest |

## Quick start (local dev)

```bash
pnpm install
pnpm dev            # http://localhost:3000
```

Apply migrations to the local D1 with `pnpm db:migrate:local`; after a schema change, regenerate with `pnpm db:generate`.

Deployed environments sit behind Cloudflare Access. Local dev uses a sign-in bypass gated on `PUBLIC_ENV=dev`, so no Access token is needed to run the app.

## Deploy

GitHub Actions handles deploys. Two workflows in [`.github/workflows/`](.github/workflows/):

- **`main.yml`** runs the quality gates on every PR, and on push to `main` deploys to the dev environment (`boop-dev`). The deploy job reuses the artifact the check job built, so it ships exactly what passed the gates.
- **`deploy-production.yml`** deploys to the `production` environment (`boop-prod`) when a `v*.*.*` git tag is pushed, after re-running the gates on the tagged commit.

Both share setup (checkout, pnpm, Node, install) through the composite action at [`.github/actions/setup`](.github/actions/setup/action.yml).

Quality gates: Biome lint/format, build (typecheck included), Vitest, `openapi:check`, `audit:patterns`. D1 migrations apply via `wrangler d1 migrations apply` against the target environment before deploy.

### Required GitHub secrets

Configure under **Settings → Secrets and variables → Actions**:

| Secret | Where to get it |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Cloudflare dashboard, **Edit Cloudflare Workers** template (Workers Scripts: Edit, D1: Edit, Account Analytics: Read). |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare dashboard sidebar, under the account name. |

Runtime secrets (`GRAPH_CLIENT_SECRET`, `FOUNDRY_API_KEY`, the secrets-store KEK) are set with `wrangler secret put` or Secrets Store, never committed.

### Per-environment wrangler config

One `wrangler.jsonc` holds dev settings at the top level and a single `env.production` block for prod overrides. The Cloudflare Vite plugin flattens the selected environment into `dist/server/wrangler.json` based on `CLOUDFLARE_ENV`:

```bash
pnpm build                            # dev (default)
CLOUDFLARE_ENV=production pnpm build  # env.production block wins
```

`wrangler deploy` reads the flattened `dist/server/wrangler.json`, so no `--env` flag is needed at deploy time. `wrangler d1 migrations apply` reads `wrangler.jsonc` directly and does need `--env production` for prod.

Non-obvious bits:

- **Bindings (`vars`, `d1_databases`, etc.) are non-inheritable**, so `env.production` redefines them in full. Compatibility date/flags, `main`, and `observability` are inheritable.
- **Worker names** are set explicitly (`boop-prod`) rather than relying on auto-suffixing.

## Architecture and docs

- [`AGENTS.md`](AGENTS.md): canonical entry point (stack, locked decisions, doc resolution, conventions).
- [`CONTEXT.md`](CONTEXT.md): domain glossary (Job, Run, Attempt, Trigger, Target, Tunnel, Channel, AlertRule, Workspace, Operator).
- [`DESIGN.md`](DESIGN.md): interface rules, cited by every UI PR.
- [`docs/adr/`](docs/adr/): Architecture Decision Records.

## Built on the boop template

boop began as a Cloudflare + TanStack starter template, and the scaffolding remains. Capabilities such as auth transports, AI providers, and email install as recipes from [app-platform-recipes](https://github.com/mwheatfill/app-platform-recipes), and `pnpm bootstrap` can rename and rewire a fresh fork. Day-to-day product work does not need the recipe machinery; it exists for deriving new apps from the same base.

## License

Proprietary to SwitchThink. See [`LICENSE`](LICENSE).
