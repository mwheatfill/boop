---
title: "ADR-0006: Microsoft Foundry via Cloudflare AI Gateway"
type: "Architecture Decision Record"
status: Accepted
date: 2026-05-09
author: "Michael Wheatfill, Cloud & Collaboration Architect"
description: "Default AI provider: Microsoft Foundry, accessed through Cloudflare AI Gateway. Vercel AI SDK as the client library."
---

# ADR-0006: Microsoft Foundry via Cloudflare AI Gateway

## Status

Accepted (2026-05-09)

## Context

SwitchThink standardizes on the Microsoft AI ecosystem (Microsoft Foundry, formerly Azure AI Foundry / Azure OpenAI). Identity governance, billing, and compliance all live there.

For Worker-hosted apps making AI calls, two questions:

- **Direct or via Gateway?** A Gateway (Cloudflare AI Gateway) provides logging, caching, rate-limiting, fallback routing, and cost tracking. Direct calls skip the Gateway latency but lose all of that.
- **Provider-coupled or provider-agnostic client?** Foundry-specific SDK locks the app in. A provider-agnostic client (Vercel AI SDK) lets apps swap providers via config.

## Decision

**Default pattern:** Worker → Cloudflare AI Gateway → Microsoft Foundry, using the **Vercel AI SDK** with the Azure OpenAI provider pointed at the Gateway URL.

**Direct opt-out:** Worker calls Foundry directly via `fetch` for latency-sensitive paths. Documented in the recipe.

**Multi-step tool calling:** `streamText` with `maxSteps` for agent-style flows.

**Chat UI:** Vercel AI Elements (shadcn-style, copied into the project).

**SSE streaming on Workers:** the streaming route handler sets `Content-Encoding: identity` to disable response compression buffering. This is in the template's streaming chat route.

## Consequences

**Positive:**

- AI Gateway gives observability (logs, request volumes, costs), caching, rate-limiting, and per-app analytics out of the box.
- AI SDK is provider-agnostic: swapping to Anthropic, OpenAI, Google, or self-hosted is a config change plus a one-line provider import.
- Multi-step tool calling, streaming, and structured outputs are all first-class in the AI SDK.
- AI Elements components copy into the project (shadcn-style); customizable, no runtime library to fight.
- Future migration to TanStack AI is straightforward when it stabilizes (1.0 + Node 24 maturity).

**Negative:**

- AI Gateway adds a small latency overhead (typically tens of ms). Latency-sensitive paths use the direct opt-out.
- Foundry-specific features that bypass the Azure OpenAI compatibility surface require custom code outside the AI SDK abstraction.
- Vercel AI SDK is on its own release cadence; breaking changes happen and need to be tracked via Renovate.

**Neutral / trade-off:**

- Choosing AI Elements over assistant-ui is a "own the surface" trade. AI Elements components live in the project; assistant-ui is an external runtime library. Same shadcn ethos as the rest of the UI layer.

## Alternatives considered

- **Direct Foundry, no Gateway** — lower latency (small), but loses logging, caching, rate-limiting, cost tracking. Lost on observability.
- **Anthropic direct** — different vendor, doesn't align with SwitchThink's Microsoft AI standard. Available as a recipe (`anthropic/chat-completion.md`).
- **OpenAI direct** — different vendor, similar to Anthropic. Available as a recipe.
- **Foundry-native SDK (Azure SDK)** — locks the app to Azure; loses provider portability. Lost on swap-ability.
- **assistant-ui (third-party chat UI library)** — earlier choice; superseded by AI Elements for shadcn-style alignment and direct Vercel AI SDK integration.
- **TanStack AI** — alpha, requires Node 24+, ecosystem still maturing. Watch-list; migration straightforward when it stabilizes.

## References

- [Microsoft Foundry documentation](https://learn.microsoft.com/en-us/azure/ai-foundry/)
- [Cloudflare AI Gateway](https://developers.cloudflare.com/ai-gateway/)
- [Vercel AI SDK](https://ai-sdk.dev/)
- [Vercel AI Elements](https://ai-sdk.dev/elements)
- Recipe: `microsoft-foundry/chat-completion.md`
- Brief: `claude-code-brief.md`, "AI provider" section
