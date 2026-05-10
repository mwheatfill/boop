---
title: "ADR-0001: Cloudflare Workers as the runtime"
type: "Architecture Decision Record"
status: Accepted
date: 2026-05-09
description: "Cloudflare Workers is the runtime; Wrangler manages multi-environment deploys."
---

# ADR-0001: Cloudflare Workers as the runtime

## Status

Accepted (2026-05-09)

## What

Cloudflare Workers is the runtime. Wrangler manages per-environment deploys via two config files: `wrangler.jsonc` (dev defaults) and `wrangler.production.jsonc` (production overrides), selected through the `WRANGLER_CONFIG` environment variable. (Single-file `env:` blocks were tried first but the TanStack Start Vite plugin flattens them; per-env files are the working pattern.)

## When this default is right

- Edge-distributed performance from any region
- Native bindings to D1, R2, Queues, AI Gateway, Hyperdrive (single control plane)
- Low ops; no separate infrastructure to operate
- Apps that fit Workers' compute model: request-response, short CPU bursts, async via Queues / Workflows / Durable Objects for long-running work

## When to switch

- Compute-heavy workloads exceeding Workers' CPU limits even on paid plans
- Specific Node.js runtime requirements that `nodejs_compat` doesn't cover
- Apps requiring runtimes Cloudflare doesn't support (Python with native deps, etc.)

## Notable

- The `nodejs_compat` flag enables most Node-isms (Pino structured logging, etc.) but not full Node.
- Cloudflare Workers Builds is an alternative deploy path (zero-config from GitHub, preview environments per PR). The template's GitHub Actions workflows ([main.yml](../../.github/workflows/main.yml), which runs the check + dev deploy, and [deploy-production.yml](../../.github/workflows/deploy-production.yml), which fires on `v*.*.*` tags) remain canonical for CI-gated deploys.

## References

- [Cloudflare Workers documentation](https://developers.cloudflare.com/workers/)
- [Wrangler documentation](https://developers.cloudflare.com/workers/wrangler/)
