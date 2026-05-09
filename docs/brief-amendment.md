---
title: "Brief Amendment: CF + TanStack Start Template"
type: "Working Note"
status: Draft
author: "Michael Wheatfill, Cloud & Collaboration Architect"
project: "Web Scheduler"
description: "Proposed amendments to claude-code-brief.md based on Phase 1 findings and Phase 1 review decisions. Does not modify the canonical brief; awaits Michael's review and application."
---

# Proposed amendments to `claude-code-brief.md`

Phase 1 review surfaced new decisions and refined a few existing ones. The brief should reflect these so it stays the source of truth for Phase 2 onward. Edits below are organized by topic, not by line number; the brief's current line numbers are cited where helpful.

---

## 1. AI provider section (current brief, lines 205–214)

### Change: replace `assistant-ui` with Vercel AI Elements

**Why:** AI Elements is shadcn-style (components copied into the project, customizable, owned in-tree), which matches the rest of the template's UI ethos. assistant-ui is a third-party runtime library that lags AI SDK feature releases. AI Elements is officially maintained by the Vercel AI SDK team and is a closer fit.

**Current:**

> **Chat UI:** `assistant-ui` for pre-built chat components. Note: `assistant-ui` integrates with Vercel AI SDK only, not TanStack AI.

**Proposed:**

> **Chat UI:** Vercel AI Elements (shadcn-style components copied into the project from `ai-sdk.dev/elements`). Pairs natively with Vercel AI SDK's `useChat`. Components are owned in-tree and customizable, matching the template's broader pattern of owning UI surface code.

### Change: update the TanStack AI watch-list note to drop the assistant-ui dependency

**Current:**

> **Future watch (not adopt yet):** TanStack AI is in alpha and requires Node.js 24+. Migration from Vercel AI SDK will be straightforward once it hits 1.0 and `assistant-ui` adds support. Recipe should call this out so it's not forgotten.

**Proposed:**

> **Future watch (not adopt yet):** TanStack AI is in alpha and requires Node.js 24+. Migration from Vercel AI SDK will be straightforward once it hits 1.0; AI Elements lives at the UI layer and is unaffected by the underlying SDK swap. Recipe should call this out so it's not forgotten.

### Change: streaming chat route lives in the template, not only in the recipe

The `Content-Encoding: identity` Workers SSE fix should live in the template's streaming chat route handler so every cloned app inherits it from day one. Recipe still documents the gotcha for context.

**Current (last bullet of the AI section):**

> Recipe `microsoft-foundry/chat-completion.md` should document the Gateway-fronted pattern (primary), the direct-Foundry opt-out, the AI SDK + `assistant-ui` chat UI integration, the SSE Workers fix, and the TanStack AI watch-list note.

**Proposed:**

> Template ships a removable streaming chat route example with the `Content-Encoding: identity` Workers SSE fix in the handler, AI Elements chat surface, and the AI SDK provider pointed at Cloudflare AI Gateway → Microsoft Foundry. Recipe `microsoft-foundry/chat-completion.md` documents the Gateway-fronted pattern (primary), the direct-Foundry opt-out, multi-step tool calling with `streamText` + `maxSteps`, and the TanStack AI watch-list note. The recipe references the template's streaming route as the canonical SSE-correct implementation rather than re-documenting the fix.

---

## 2. Tech stack defaults table (current brief, line 255)

### Change: AI chat UI row

**Current row:**

| AI chat UI | `assistant-ui` + Vercel AI SDK | Streaming chat, markdown, tool calls, file attachments. AI SDK's Azure OpenAI provider points at Microsoft Foundry. |

**Proposed row:**

| AI chat UI | Vercel AI Elements + Vercel AI SDK | shadcn-style components copied into the project. Streaming chat, markdown, tool calls. AI SDK's Azure OpenAI provider points at Cloudflare AI Gateway → Microsoft Foundry. |

---

## 3. Template infrastructure table (current brief, "Template infrastructure (every app gets these)", line 267)

### Add: agent governance rows

Append the following rows to the table:

| Concern | Approach |
|---|---|
| Agent governance, canonical | `AGENTS.md` at repo root is the cross-harness canonical entry. `CLAUDE.md` and `.cursorrules` are thin shims pointing at it. |
| Agent governance, neutral rules | `agent-rules/` directory (no leading dot) with harness-agnostic markdown: `lookup-order.md`, `dependencies.md`, `spec-fidelity.md`, `architecture.md`, `api-contract.md`, `intent.md`, `conventions.md`, `codex-config.md`. |
| Agent governance, gate layer | `.claude/settings.json` with permission allow-list (read-only and idempotent commands) and MCP server preconfig (Cloudflare Docs, Microsoft Learn, Context7). `pnpm add/remove/update/uninstall` are not allow-listed; every dep change prompts the user. |
| Doc lookup protocol | `agent-rules/lookup-order.md` codifies a 7-step ordering: project rules → Intent skills → MCP servers → llms.txt → vendor docs → web search → training data (last, must verify). |
| Agent currency: in-tree library guidance | TanStack Intent installed and wired with `intent install` (bootstrap + on dep change), `intent load` (per-task), `intent stale` (CI soft gate). Cadence codified in `agent-rules/intent.md`. |
| Agent currency: external library guidance | MCP servers preconfigured in `.claude/settings.json`: Cloudflare Docs (`docs.mcp.cloudflare.com`), Microsoft Learn, Context7. |
| Discoverability surface | `robots.txt` with AI-bot directives, `sitemap.xml` generated from TSR routes, `Link` response headers in the Worker pointing at the well-known endpoints below. |
| `.well-known/api-catalog` | Route handler linking to the generated `openapi.json`. |
| `.well-known/oauth-protected-resource` | Better Auth OIDC metadata served per the OAuth Protected Resource spec. |
| `.well-known/mcp-server-card` | Returns 404 unless the MCP server recipe is installed; returns metadata once it is. |
| CI quality gates | `openapi-contract` (hard gate) catches drift between server functions and `openapi.json`. `intent:stale` (soft gate) flags TanStack Intent skill freshness. |

### Update: existing rows (light touch)

The existing infrastructure rows (health endpoint, env validation, error boundaries, light/dark/system theme, pre-commit hooks, structured logging) stay as written. The "structured logging" row should reference Pino specifically; HoopsLoop confirms it as the load-bearing choice.

---

## 4. New section: Agent governance (under "Architectural decisions")

Add a new subsection under "Architectural decisions" between **Auth** and **On-prem connectivity**. This codifies the load-bearing pattern that emerged in Phase 1 review.

> ### Agent governance
>
> Apps cloned from this template are expected to be evolved primarily by AI coding agents (Claude Code, Codex, Cursor, Aider). Agent-readability is a first-class concern, with the same weight as runtime correctness. The governance layer separates **rules** (harness-agnostic markdown) from **gates** (harness-specific configuration).
>
> **Rules layer — neutral, portable across harnesses:**
>
> - `AGENTS.md` at repo root is the canonical entry. Codex reads it natively; Claude Code reads it via the `CLAUDE.md` shim; Cursor reads it via the `.cursorrules` shim.
> - `agent-rules/` (no leading dot) holds harness-agnostic markdown:
>   - `lookup-order.md` — 7-step doc-resolution protocol so agents reference current docs over training data
>   - `dependencies.md` — latest-stable selection, propose-and-confirm before adding deps, pinning policy, removal protocol
>   - `spec-fidelity.md` — locate the canonical spec at session start, re-anchor before architectural moves
>   - `architecture.md` — auth boundaries, data flow, validation
>   - `api-contract.md` — `openapi.json` is the contract; the openapi-contract guard protects it
>   - `intent.md` — cadence for TanStack Intent (install on bootstrap and dep change; load per-task; stale in CI)
>   - `conventions.md` — naming, formatting, error handling
>   - `codex-config.md` — Codex equivalents to the Claude Code permission and MCP setup
>
> **Gate layer — harness-specific:**
>
> - `.claude/settings.json` for Claude Code:
>   - Permissions allow-list: read-only and idempotent commands (`pnpm install`, `pnpm test`, `pnpm dev`, `pnpm build`, `pnpm check`, `npm view`, etc.)
>   - Permissions deny by omission: `pnpm add`, `pnpm remove`, `pnpm update`, `pnpm uninstall` — every dep change prompts the user, redundant with `agent-rules/dependencies.md` so the gate fires even if the agent skips the proposal step
>   - MCP server preconfig: Cloudflare Docs, Microsoft Learn, Context7
> - Codex equivalents documented in `agent-rules/codex-config.md`, written against current Codex configuration at scaffold time
>
> **Documentation currency — keeping agents on current docs, not training data:**
>
> Layered protocol (codified in `agent-rules/lookup-order.md`):
>
> 1. Project-local rules (`agent-rules/*`)
> 2. TanStack Intent skills (in-tree, version-locked to installed packages)
> 3. Configured MCP servers (Cloudflare Docs, Microsoft Learn, Context7)
> 4. `llms.txt` at vendor domain
> 5. Vendor official docs via WebFetch
> 6. Web search
> 7. Training data — last resort, must be verified against (2)–(4)
>
> Intent solves drift for in-tree libraries that ship `SKILL.md`. MCP servers cover external SDKs and services. The protocol degrades gracefully if any layer is unavailable.

---

## 5. New section: Agent-ready surface (under "Architectural decisions")

Add a new subsection capturing the `isitagentready.com`-derived discovery scaffolding that ships in the template.

> ### Agent-ready surface
>
> Internal apps built from this template should be agent-discoverable from day one, even if they don't yet expose an MCP server. The discovery scaffolding is cheap (~100 lines of route handlers, all reading from data the template already produces) and degrades gracefully when capabilities are not installed.
>
> **Shipped in the template:**
>
> - `public/robots.txt` with AI-bot directives
> - `app/routes/sitemap.xml.ts` generated from the TSR route tree
> - `app/routes/.well-known/api-catalog.ts` linking to `openapi.json`
> - `app/routes/.well-known/oauth-protected-resource.ts` (Better Auth OIDC metadata, per OAuth Protected Resource spec)
> - `app/routes/.well-known/mcp-server-card.ts` (404 unless MCP server recipe installed; metadata once it is)
> - Worker fetch handler adds `Link` response headers pointing at the well-known endpoints
>
> **Not shipped in the template (by design):**
>
> - The MCP server itself is a recipe (`mcp/expose-app-as-mcp-server.md`, the Cloudflare port of the existing `+mcp-server` Azure recipe). When installed, the discovery scaffolding above announces it automatically.
> - Web Bot Auth (cryptographic bot verification) is a recipe.
> - Markdown content negotiation is a recipe (most internal apps don't have public content surfaces).
> - x402 / commerce protocols are out of scope for internal apps.

---

## 6. Storage section affirmation (current brief, lines 162–167)

The brief already states D1 is the default and Neon is a swap recipe. Phase 1 confirms: HoopsLoop's Neon + Hyperdrive patterns transfer cleanly to a `data-layer/switch-to-neon-postgres.md` recipe (adapter swap + Hyperdrive bindings + per-request `pg` client setup + `DATABASE_URL` from `.dev.vars`). No edit required to the brief; flagging only that this is now confirmed by survey, not assumed.

---

## 7. Locked tech stack defaults — small clarifications (current brief, line 255)

### `react-day-picker` clarification

The brief drop list (implicit in the consumer-only deps Michael called out) included `react-day-picker`. Phase 1 confirms it's the underlying engine of shadcn `Calendar` / `DatePicker`, so it stays as a transitive part of the shadcn date-component install. No separate row needed; flag here for traceability.

### `next-themes` clarification

Earlier discussion considered dropping `next-themes` because of its misnamed prefix. Phase 1 review concluded it stays — it's the canonical shadcn theme provider, framework-agnostic despite the name, and the no-flash trick is non-trivial to own. The brief's existing tech-stack table doesn't list it explicitly; adding it would be appropriate, with a one-line note that the "next-" prefix is historical (works in any React 18+ app, including TanStack Start).

**Suggested new row in the tech stack table:**

| Theming | `next-themes` | Light/dark/system mode with localStorage persistence and no-flash inline script. Despite the name, framework-agnostic; the shadcn-canonical choice. |

---

## 8. Open questions section (current brief, lines 299–311)

All nine resolved. Replace the section with:

> ## Phase 1 review outcomes
>
> The original nine open questions have been answered against the HoopsLoop survey and Phase 1 review decisions. See `template-cf-fullstack/docs/findings.md` for the full breakdown including patterns extracted, verdicts (template / recipe / drop), and locked decisions. Sixteen total decisions were locked during review (the original nine plus seven new ones surfaced during discussion: AI Elements, react-day-picker correction, agent governance structure, agent-ready surface, Intent cadence, MCP harness preconfig, dependency governance, spec fidelity, repo name, recipes reorg sequencing).

---

## 9. Initial recipes list refinements (current brief, "Initial recipes to create" list)

Two changes:

**Add** to the list:

- **`mcp/expose-app-as-mcp-server.md`** — Worker-hosted MCP server with Streamable HTTP transport, OpenAPI-driven tool generation, Better Auth integration. CF port of the existing `+mcp-server` Azure recipe.
- **`agent-guards/add-a-guard.md`** — pattern for adding a remediation guard script + CI hook, reference implementation = the openapi-contract guard already shipped in the template.
- **`testing/playwright-e2e.md`** — optional e2e testing recipe (HoopsLoop is Vitest-only; Playwright is named in the brief but not in deps).

**Defer** (do not include in initial set):

- `email/react-email-editor.md` — HoopsLoop has the dep but no UI pattern to lift; revisit when an app needs it.

**Note on existing Azure recipes:** `+copilot-agent`, `+cmdk-prompt`, `+mcp-server`, `+graph-mail-send` get reorganized into the new domain tree (option c) before any new recipes land. `+graph-mail-send` becomes `email/graph-shared-mailbox.md`; `+mcp-server` informs `mcp/expose-app-as-mcp-server.md` (Azure variant retained for `template-az-fullstack`).

---

## Application notes

- The amendments above can be applied wholesale to the canonical brief or selectively. Findings.md remains the source of detailed survey results; the brief stays the high-level locked-in design document.
- After application, increment the brief's `status` from `Draft` to `Reviewed` (or similar) and add a "Last revised: 2026-05-09" line near the top.
- No further amendments are expected before Phase 2 begins.
