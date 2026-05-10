---
title: "ADR-0006: AI is recipe-only; Vercel AI SDK + AI Gateway is the recommended pattern"
type: "Architecture Decision Record"
status: Accepted
date: 2026-05-09
description: "The template ships nothing AI-related. AI capabilities are recipes: a chat-route recipe owns the streaming endpoint, a chat-ui recipe owns the surface, and a provider recipe owns the model wiring. Microsoft Foundry via Cloudflare AI Gateway is the default provider recipe."
---

# ADR-0006: AI is recipe-only; Vercel AI SDK + AI Gateway is the recommended pattern

## Status

Accepted (2026-05-09)

## What

The template ships no AI code, no AI dependencies, and no AI env vars. Apps that need AI install three layers from [`app-platform-recipes`](https://github.com/mwheatfill/app-platform-recipes):

1. **`ai/chat-route`**: auth-protected streaming chat endpoint, including the Cloudflare Workers `Content-Encoding: identity` SSE workaround. Depends on an auth recipe.
2. **`ai/chat-ui`**: chat surface using the AI SDK's `useChat`. Documented upgrade path to AI Elements when AI Elements stabilizes for non-Next deployments.
3. **A provider recipe.** Default is `microsoft-foundry/chat-completion` (Cloudflare AI Gateway → Microsoft Foundry). Alternates: planned `cloudflare-workers-ai/setup`, `anthropic/chat-completion`, `openai/chat-completion`.

The chosen AI client library across recipes is the Vercel AI SDK; the chat UI surface is shadcn-style components owned in-tree.

| Provider | Recipe |
|---|---|
| Microsoft Foundry (default) | [`microsoft-foundry/chat-completion`](https://github.com/mwheatfill/app-platform-recipes/tree/main/recipes/microsoft-foundry/chat-completion) |
| Cloudflare Workers AI | Planned: `cloudflare-workers-ai/setup` |
| Anthropic | Planned: `anthropic/chat-completion` |
| OpenAI | Planned: `openai/chat-completion` |

Each recipe adds the env vars it needs to `.dev.vars`. The template's `.dev.vars.example` ships with no AI-related entries; the `microsoft-foundry/chat-completion` recipe is the source of truth for which env vars Microsoft Foundry routing needs.

## When this default is right

- Apps building AI features (chat, agents, structured generation, streaming UI) on Cloudflare Workers
- Want provider-agnostic code so swapping providers is a config change, not a rewrite
- Want a chat UI surface owned in-tree (shadcn-style), not a runtime library to fight

## When to switch

- Need a feature only one provider's SDK exposes: drop to that SDK in a single isolated module, keep the AI SDK abstraction everywhere else.
- Want TanStack AI specifically (alpha; on the watch list for adoption when it stabilizes).

## Notable

- **The SSE `Content-Encoding: identity` fix is non-negotiable on Workers.** Without it, Workers' default response compression buffers the SSE stream and chat appears to hang. The `ai/chat-route` recipe owns this header; if you add a custom streaming endpoint outside the recipe, copy the pattern.
- **Multi-step tool calling:** `streamText` with `maxSteps`. Pattern documented in the `ai/chat-route` recipe README.
- **AI Gateway fronting** (Cloudflare AI Gateway → provider) is the recommended production pattern: gives logging, caching, rate-limiting, fallback routing, and cost tracking. The AI SDK's Azure OpenAI provider works against any Azure-OpenAI-compatible endpoint, including Microsoft Foundry directly or via AI Gateway.
- **AI SDK 6.x note for recipe authors:** `convertToModelMessages` returns a `Promise` and must be `await`ed. The `ai/chat-route` recipe handles this; recipe forks need to preserve it.

## References

- [Vercel AI SDK](https://ai-sdk.dev/)
- [AI Elements](https://ai-sdk.dev/elements)
- [Cloudflare AI Gateway](https://developers.cloudflare.com/ai-gateway/)
- [Cloudflare Workers AI](https://developers.cloudflare.com/workers-ai/)
