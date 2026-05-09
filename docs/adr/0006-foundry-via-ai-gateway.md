---
title: "ADR-0006: AI SDK + AI Elements; provider via env"
type: "Architecture Decision Record"
status: Accepted
date: 2026-05-09
description: "Vercel AI SDK is the client library, AI Elements is the chat UI; the AI provider is env-driven with one recipe per provider."
---

# ADR-0006: AI SDK + AI Elements; provider via env

## Status

Accepted (2026-05-09)

## What

Vercel AI SDK is the AI client library. AI Elements provides shadcn-style chat UI components (copied into the project, customizable). The streaming chat route at `src/routes/api/chat.ts` is wired and removable for apps that don't need it.

The AI provider is env-driven via `AI_PROVIDER`. `.dev.vars.example` ships with commented blocks for each supported provider; uncomment the one you want active.

| Provider | Recipe |
|---|---|
| Cloudflare Workers AI | [`cloudflare-workers-ai/setup.md`](https://github.com/mwheatfill/app-platform-recipes/tree/main/recipes/cloudflare-workers-ai) |
| Microsoft Foundry | [`microsoft-foundry/chat-completion.md`](https://github.com/mwheatfill/app-platform-recipes/tree/main/recipes/microsoft-foundry) |
| Anthropic | [`anthropic/chat-completion.md`](https://github.com/mwheatfill/app-platform-recipes/tree/main/recipes/anthropic) |
| OpenAI | [`openai/chat-completion.md`](https://github.com/mwheatfill/app-platform-recipes/tree/main/recipes/openai) |

## When this default is right

- Apps building AI features (chat, agents, structured generation, streaming UI) on Cloudflare Workers
- Want provider-agnostic code so swapping providers is a config change, not a rewrite
- Want a chat UI surface owned in-tree (shadcn-style), not a runtime library to fight

## When to switch

- Need a feature only one provider's SDK exposes — drop to that SDK in a single isolated module, keep the AI SDK abstraction everywhere else
- Want TanStack AI specifically (alpha; on the watch list for adoption when it stabilizes)

## Notable

- **The SSE `Content-Encoding: identity` fix is non-negotiable on Workers.** Without it, Workers' default response compression buffers the SSE stream and chat appears to hang. The template's `src/routes/api/chat.ts` sets this header; don't remove it.
- **Multi-step tool calling:** `streamText` with `maxSteps`. Pattern documented in the chat route.
- **AI Gateway fronting** (Cloudflare AI Gateway → provider) is the recommended production pattern: gives logging, caching, rate-limiting, fallback routing, and cost tracking. The AI SDK's Azure OpenAI provider works against any Azure-OpenAI-compatible endpoint, including Microsoft Foundry directly or via AI Gateway.

## References

- [Vercel AI SDK](https://ai-sdk.dev/)
- [AI Elements](https://ai-sdk.dev/elements)
- [Cloudflare AI Gateway](https://developers.cloudflare.com/ai-gateway/)
- [Cloudflare Workers AI](https://developers.cloudflare.com/workers-ai/)
