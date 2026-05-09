---
title: "ADR-0001: Cloudflare Workers as the runtime"
type: "Architecture Decision Record"
status: Accepted
date: 2026-05-09
author: "Michael Wheatfill, Cloud & Collaboration Architect"
description: "The template targets Cloudflare Workers as the runtime for SwitchThink internal apps."
---

# ADR-0001: Cloudflare Workers as the runtime

## Status

Accepted (2026-05-09)

## Context

SwitchThink is building a series of internal apps for the engineering and operations teams. Each app needs:

- Low-ops runtime: small team, no dedicated SRE.
- Edge-distributed performance: apps should feel snappy from anywhere SwitchThink staff work.
- Integration with the existing Cloudflare investments: Tunnel for on-prem reach to internal IIS services, Access for SSO, AI Gateway for Foundry observability, R2 for blob storage.
- A scaffold that doesn't lock the team into a single ecosystem.

The web scheduler is the first app and the catalyst, but the runtime choice has to fit ten future apps as well.

## Decision

Cloudflare Workers is the runtime for all apps cloned from this template. Wrangler is the deploy tool, multi-environment by default (`dev`, `production`).

## Consequences

**Positive:**

- Native bindings to D1 (database), R2 (blobs), Queues (async), Hyperdrive (Postgres), AI Gateway (Foundry) — single control plane.
- Zero cold-start at edge; instant first response for any region.
- Workers Builds supports zero-config GitHub deploys when teams want them; GitHub Actions remains the default for quality-gated deploys.
- Cloudflare Tunnel provides a clean path to on-prem services without inbound firewall holes.
- Free / cheap for low-volume internal apps; predictable pricing as scale rises.

**Negative:**

- Workers runtime constraints: not full Node.js. Some npm packages don't work without `nodejs_compat` flag, and a few don't work at all.
- CPU time limits per request (50ms on Bundled plan, longer on paid). Apps with heavy compute paths need workarounds (Queues, Workflows, or Durable Objects).
- Vendor lock-in to Cloudflare for the runtime layer; mitigated by TanStack Start being framework-portable to Node.

**Neutral / trade-off:**

- Smaller npm compatibility surface than Vercel or AWS Lambda. The recipes repo documents workarounds for the common cases (Pino requires `nodejs_compat`, etc.).

## Alternatives considered

- **Vercel** — excellent DX, but adds a layer over the network (Vercel functions deploy to AWS Lambda or Vercel's edge runtime, not Cloudflare). SwitchThink's existing Tunnel/Access/AI Gateway investments don't extend cleanly. Lost on integration.
- **Node + traditional cloud (Azure App Service, AWS ECS, etc.)** — more ops, slower to deploy, no edge story. Lost on ops cost and latency.
- **Deno Deploy** — smaller ecosystem, no Cloudflare-native integrations. Lost on integration breadth.
- **AWS Lambda + API Gateway** — cold-starts, more wiring per service, no native CF integration. Lost on DX and integration.

## References

- [Cloudflare Workers documentation](https://developers.cloudflare.com/workers/)
- [Wrangler documentation](https://developers.cloudflare.com/workers/wrangler/)
- Brief: `claude-code-brief.md`, "Compute and runtime" section
