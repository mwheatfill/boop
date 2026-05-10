# ADR-007: AI is recipe-only; AI SDK + AI Gateway is the recommended pattern

![Status](https://img.shields.io/badge/status-Accepted-brightgreen) ![Date](https://img.shields.io/badge/date-2026--05--09-blue)

## Context

AI features (chat, agents, structured generation, streaming UI) span three concerns: the streaming endpoint, the chat surface, and the model wiring. Putting all three in the template would force every app to ship AI dependencies and env vars whether it uses them or not. Splitting them across recipes lets each app install only what it needs and switch providers via config rather than rewrite.

## Decision

The template ships no AI code, no AI dependencies, and no AI env vars. Apps that need AI install three layers from [`app-platform-recipes`](https://github.com/mwheatfill/app-platform-recipes):

1. **`ai/chat-route`**: auth-protected streaming chat endpoint, including the Cloudflare Workers `Content-Encoding: identity` SSE workaround. Depends on an auth recipe.
2. **`ai/chat-ui`**: chat surface using the AI SDK's `useChat`. Documented upgrade path to AI Elements when AI Elements stabilizes for non-Next deployments.
3. **A provider recipe.** Default is [`microsoft-foundry/chat-completion`](https://github.com/mwheatfill/app-platform-recipes/tree/main/recipes/microsoft-foundry/chat-completion) (Cloudflare AI Gateway → Microsoft Foundry). Alternates: planned `cloudflare-workers-ai/setup`, `anthropic/chat-completion`, `openai/chat-completion`.

Across recipes, the AI client library is the [Vercel AI SDK](https://ai-sdk.dev/); the chat UI surface uses shadcn-style components owned in-tree per [ADR-008](008-ui-visual-layer.md). [Cloudflare AI Gateway](https://developers.cloudflare.com/ai-gateway/) fronts the provider in production for logging, caching, rate-limiting, fallback routing, and cost tracking.

## Consequences

**Positive:**

- Apps that don't need AI ship nothing AI-related (no deps, no env vars, no dead code).
- Provider swap (Foundry → OpenAI → Anthropic) is a recipe install + env var change, not a rewrite.
- Chat UI surface is owned in-tree (shadcn-style), not a runtime library to fight.

**Negative:**

- Three recipes to install for a working chat surface (vs. one if it were template-shipped). Mitigated by recipe install ordering being mechanical and well-documented.
- Provider-specific features need either a single isolated module dropping to that SDK, or a custom provider in the AI SDK pattern.

**Neutral / trade-off:**

- The SSE `Content-Encoding: identity` fix is non-negotiable on Workers; without it, default response compression buffers the SSE stream and chat appears to hang. Owned by the `ai/chat-route` recipe; custom streaming endpoints outside the recipe must copy the pattern.
- AI SDK 6.x: `convertToModelMessages` returns a `Promise` and must be `await`ed. The `ai/chat-route` recipe handles this; recipe forks need to preserve it.
