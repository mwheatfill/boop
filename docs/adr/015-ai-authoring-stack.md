# ADR-015: AI authoring stack (Vercel AI SDK, Cloudflare Agents, Code Mode, MCP server)

![Status](https://img.shields.io/badge/status-Proposed-yellow) ![Date](https://img.shields.io/badge/date-2026--05--11-blue)

## Context

boop's product vision includes AI-native authoring (chat-to-Job and runbook narration) through Microsoft Foundry, and programmatic access for external agents over MCP. [ADR-007](007-foundry-via-ai-gateway.md) fixed the model transport (Foundry via Cloudflare AI Gateway), and [ADR-012](012-discoverability-in-template.md) left the MCP server itself as a recipe install rather than a template default.

This ADR specifies the in-tree libraries and integration shape that sit between those decisions: how the chat assistant runs, how it discovers and calls boop's tools without bloating the model context, and how the same tool catalog is published to third-party agents. The decision is load-bearing because the wrong layer split forces either re-inventing infrastructure (rolling our own tool dispatch, model streaming, conversation state) or fragmenting the tool surface across two unrelated code paths.

## Decision

A four-library agent-side stack sitting on top of the [ADR-007](007-foundry-via-ai-gateway.md) AI Gateway, plus the [`mcp/expose-app-as-mcp-server`](https://github.com/mwheatfill/app-platform-recipes/tree/main/recipes/mcp/expose-app-as-mcp-server) recipe for external MCP. One typed Tool catalog feeds both surfaces.

| Layer | Choice | Over |
|---|---|---|
| Model SDK | [**Vercel AI SDK (`ai`)**](https://sdk.vercel.ai) — `streamText`, `convertToModelMessages`, `stepCountIs`. Provider abstraction calls Foundry via AI Gateway. | LangChain (heavier, less Workers-shaped); raw `fetch()` to Foundry (re-implements streaming, tool calls, message conversion). |
| Agent runtime | [**Cloudflare Agents SDK (`agents`)**](https://developers.cloudflare.com/agents/) — `Agent` base class with `onChatMessage`, conversation state in Durable Object storage, scheduled methods via DO alarms. | Vanilla Durable Objects (re-implement conversation persistence and message dispatch); stateless Worker (loses turn-to-turn context). |
| Tool dispatch | [**`@cloudflare/codemode`**](https://developers.cloudflare.com/agents/api-reference/codemode/) — `createCodeTool({ tools, executor })` plus `DynamicWorkerExecutor`. The model writes JS that calls typed `codemode.*` methods; generated code runs in an isolated [Dynamic Worker](https://developers.cloudflare.com/workers/runtime-apis/bindings/worker-loader/). | One tool definition per function in the model context (token cost grows with catalog size, surfaces credentials to the model). |
| Chat UI | **AI Elements** — `<Conversation>`, `<Message>`, `<PromptInput>` primitives. Plugs into the AI SDK's streaming response shape. | Hand-rolling chat UI on top of shadcn primitives (per [ADR-008](008-ui-visual-layer.md), shadcn-base-vega is the visual foundation; AI Elements composes on top, not in conflict). |
| External MCP | [**`mcp/expose-app-as-mcp-server`** recipe](https://github.com/mwheatfill/app-platform-recipes/tree/main/recipes/mcp/expose-app-as-mcp-server) installed, MCP portal connected with [`?optimize_context=search_and_execute`](https://developers.cloudflare.com/cloudflare-one/access-controls/ai-controls/mcp-portals/) so third-party agents see two tools (`query`, `execute`) instead of the full catalog. | Per-tool MCP exposure (token cost balloons as the catalog grows); no MCP at all (closes off agent integration). |
| Tool catalog source of truth | **One typed module** consumed by both surfaces. Same Zod schemas that produce `public/openapi.json` define each tool's input/output. | Two parallel catalogs (one for Code Mode, one for MCP) that drift apart. |
| AI authoring guarantee | **No direct mutation by the model.** Tools that change state (`propose_job`, `propose_template`) return drafts. Operator confirmation in the UI is the only path from draft to written row. | Tool-calling that writes directly (loses operator-in-the-loop safety). |

`wrangler.jsonc` gains a `worker_loader` binding for the Dynamic Worker executor. AI Gateway is added as a binding per ADR-007's recipe install.

## Consequences

**Positive:**

- One tool catalog feeds REST, the in-app authoring assistant, and the external MCP server. New capabilities ship as one typed function and immediately surface across all three.
- Token cost stays constant as the catalog grows. Code Mode + `search_and_execute` collapse N tool definitions into a constant overhead, so adding tools does not degrade the chat or external MCP experience.
- Conversation state is durable (DO-backed via the Agents SDK), so an Operator refreshing the browser mid-authoring does not lose context.
- The Operator-in-the-loop guarantee (no direct mutation) is enforced by the tool design itself, not by guardrails layered on top.
- External agent integrations are first-class. Third parties register the MCP portal URL once and pick up new tools automatically.

**Negative:**

- Five libraries to keep in version sync (`ai`, `agents`, `@cloudflare/codemode`, `ai-elements`, plus the AI provider package for Foundry-via-AI-Gateway). Renovate config needs to group these.
- The `worker_loader` binding is new to boop. Permissions and resource budgets for the Dynamic Worker executor need explicit configuration in `wrangler.jsonc`, and the isolation boundary needs to be respected when adding tools that touch sensitive bindings.
- Setting up the AI authoring stack is a multi-step recipe install (AI Gateway, Foundry provider, MCP server) plus three `pnpm add` proposals. Each install needs the deny-by-default `pnpm add` flow to clear, so the bootstrap is not a single command.
- AI Elements is a separate UI library on top of shadcn-base-vega. Visual consistency requires a small style-bridge layer; the alternative (hand-rolling chat UI) is more work overall.

**Neutral / trade-off:**

- This ADR composes with [ADR-007](007-foundry-via-ai-gateway.md) (model transport) and [ADR-012](012-discoverability-in-template.md) (MCP-as-recipe) without superseding either. The template-level question of whether to bake MCP into every app (instead of recipe-on-install) is open; this ADR scopes the choice to boop specifically.
- The Code Mode pattern depends on Cloudflare's Worker Loader API and Dynamic Workers, which are still relatively new primitives. If they evolve incompatibly, the agent-side stack here needs a re-pin. The external MCP portal is more stable.
