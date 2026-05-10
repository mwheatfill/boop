# ADR-001: Cloudflare Workers as the runtime

![Status](https://img.shields.io/badge/status-Accepted-brightgreen) ![Date](https://img.shields.io/badge/date-2026--05--09-blue)

## Context

Picking the runtime locks every downstream choice: deploy primitives, native bindings, cold-start profile, request shape (HTTP / Queues / Cron / Durable Objects), and the regional execution model. The template is built around Cloudflare's developer platform, so the runtime call is foundational; everything else (data, AI, real-time, deploy) assumes Workers and uses its bindings rather than IaaS substitutes.

## Decision

Cloudflare Workers, deployed via Wrangler. A single [`wrangler.jsonc`](https://developers.cloudflare.com/workers/wrangler/configuration/) at the repo root holds dev settings at the top level and an `env.production` block for production overrides; the [Cloudflare Vite plugin](https://github.com/cloudflare/workers-sdk/tree/main/packages/vite-plugin) selects the active environment at build time via `CLOUDFLARE_ENV` (unset = dev, `production` = prod). This is the canonical multi-env pattern from [Cloudflare's docs](https://developers.cloudflare.com/workers/wrangler/environments/); an earlier iteration of this template shipped two separate wrangler files plus a `WRANGLER_CONFIG` env var, which misread the plugin's intentional flattening as a bug.

## Consequences

**Positive:**

- Edge-distributed performance from any region without per-region infrastructure.
- Native bindings to D1, R2, Queues, AI Gateway, Hyperdrive on a single control plane.
- Low ops; no separate infrastructure to operate beyond the Cloudflare account + Wrangler.

**Negative:**

- Compute-heavy workloads exceeding Workers' CPU limits even on paid plans need a different runtime.
- Specific Node.js APIs that `nodejs_compat` doesn't cover are unavailable.
- Runtimes Cloudflare doesn't support (Python with native deps, etc.) need an entirely different platform.

**Neutral / trade-off:**

- The `nodejs_compat` flag enables most Node-isms (Pino structured logging, etc.) but not full Node.
- Cloudflare Workers Builds is an alternate deploy path (zero-config from GitHub, preview environments per PR). The template's GitHub Actions workflows ([`main.yml`](../../.github/workflows/main.yml) for check + dev deploy; [`deploy-production.yml`](../../.github/workflows/deploy-production.yml) for `v*.*.*` tags) remain canonical for CI-gated deploys.
