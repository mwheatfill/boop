---
title: "ADR-0010: Skill currency protocol (TanStack Intent + MCP servers)"
type: "Architecture Decision Record"
status: Accepted
date: 2026-05-09
author: "Michael Wheatfill, Cloud & Collaboration Architect"
description: "Layered protocol so AI agents reference current docs over training data: project rules → Intent skills → MCP servers → llms.txt → vendor docs → web search → training data."
---

# ADR-0010: Skill currency protocol (TanStack Intent + MCP servers)

## Status

Accepted (2026-05-09)

## Context

A recurring failure mode in AI coding agent workflows: the agent has a knowledge cutoff, the library has shipped breaking changes since the cutoff, and the agent confidently writes code against an old API. The user catches it in review (or worse, in production).

This is a real pain point in the reference app (HoopsLoop): agents repeatedly suggested patterns from older versions of TanStack libraries because the training data favored the more-talked-about older shapes.

The fix is a layered protocol that keeps agents on current docs by default, with training data as the last resort.

## Decision

The template ships and codifies a seven-step doc-resolution protocol in `agent-rules/lookup-order.md`:

```
1. Project-local rules         → agent-rules/*.md, AGENTS.md, docs/adr/*.md
2. TanStack Intent skills      → npx @tanstack/intent load <package>#<skill>
3. Configured MCP servers      → Cloudflare Docs, Microsoft Learn, Context7
4. llms.txt at vendor domain   → curl https://<vendor>/llms.txt
5. Vendor official docs        → WebFetch on the canonical doc URL
6. Web search                  → only when (1)–(5) yield nothing
7. Training data               → last resort; must be verified against (2)–(5)
```

**Mechanisms:**

- **TanStack Intent** (`@tanstack/intent`) installed as a devDep. Skills ship inside TanStack npm packages and version-lock to installed versions. Cadence rules in `agent-rules/intent.md`: install on bootstrap and dep change; load per-task; stale check in CI as a soft gate.
- **MCP servers preconfigured** in `.claude/settings.json`: Cloudflare Docs (`docs.mcp.cloudflare.com`), Microsoft Learn, Context7. Codex equivalents in `agent-rules/codex-config.md`.
- **`agent-rules/lookup-order.md`** codifies the protocol and explains the why so agents that read the rule follow the order rather than skip ahead.

## Consequences

**Positive:**

- Agent-generated code matches the version of the library actually installed, not whatever the training data remembers.
- Layers degrade gracefully: if Intent has no skill for a package, agents fall through to MCP servers; if no MCP, fall through to `llms.txt`; etc.
- Cheap to add to existing apps: install Intent, configure MCP servers, point at `agent-rules/lookup-order.md`. The protocol is explanatory, not prescriptive — agents can apply judgment.
- Future-friendly: more libraries adopting the SKILL.md / Intent pattern means more layers (2) coverage; new MCP servers slot into layer (3).

**Negative:**

- TanStack Intent is pre-1.0 (`0.0.x`). The template depends on its API stabilizing. Mitigated by Intent being additive — the protocol works without it; Intent just makes layer 2 better.
- MCP server uptime affects agents' ability to resolve layer (3). Falls through to (4)/(5) if a server is down.
- The protocol is documentation; agents have to actually read and follow it. The rule file is short and explicit, but adoption is per-agent-session.

**Neutral / trade-off:**

- The template ships the *protocol*, not exhaustive skill content. Each library or vendor's skill content is owned by them (TanStack ships SKILL.md; Cloudflare ships an MCP). The template's job is to wire the protocol so the content reaches agents in the right order.

## Alternatives considered

- **Web search only** — slow, returns mixed-version content, doesn't know what's installed. Lost on accuracy and version awareness.
- **Training data only** — guaranteed stale by definition. The exact problem this ADR addresses.
- **Intent only** — covers TanStack libraries; doesn't cover Cloudflare, Microsoft, Better Auth, AI SDK, etc. Lost on coverage.
- **MCP servers only** — covers vendor docs but not in-tree library skills. Lost on version-locked guidance for the libraries that ship skills.
- **Roll our own version-aware doc fetcher** — high build cost, and the ecosystem's existing primitives (Intent, MCP, llms.txt) cover the same need with less code. Lost on build vs. buy.

## References

- [TanStack Intent](https://tanstack.com/intent)
- [Cloudflare Docs MCP](https://docs.mcp.cloudflare.com/)
- [Microsoft Learn MCP](https://learn.microsoft.com/en-us/training/support/mcp)
- [Context7 MCP](https://context7.com/)
- [llms.txt](https://llmstxt.org/)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- Rule: `agent-rules/lookup-order.md`
- Rule: `agent-rules/intent.md`
- Brief: `claude-code-brief.md`, "Agent governance" section, "Documentation currency, the layered protocol" subsection
