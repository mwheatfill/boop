---
title: "ADR-0010: Skill currency protocol (Intent + MCP)"
type: "Architecture Decision Record"
status: Accepted
date: 2026-05-09
description: "Seven-step doc-resolution protocol so AI agents reference current sources over training data."
---

# ADR-011: Skill currency protocol (Intent + MCP)

## Status

Accepted (2026-05-09)

## What

A layered protocol agents follow when resolving documentation questions, codified in [`agent-rules/lookup-order.md`](../../agent-rules/lookup-order.md):

```
1. Project rules         → agent-rules/, AGENTS.md, docs/adr/
2. TanStack Intent       → npx @tanstack/intent load <pkg>#<skill>
3. MCP servers           → Cloudflare Docs, Microsoft Learn, Context7
4. llms.txt              → curl https://<vendor>/llms.txt
5. Vendor official docs  → WebFetch on the canonical URL
6. Web search            → only when (1)–(5) yield nothing
7. Training data         → last resort; verify against (2)–(5)
```

`@tanstack/intent` is installed as a devDep. MCP servers are pre-configured in `.claude/settings.json`. Cadence rules for Intent live in [`agent-rules/intent.md`](../../agent-rules/intent.md).

## When this default is right

Always. Library APIs change; agent training data goes stale. The protocol keeps agents on current sources by default.

## When to switch

Don't switch the protocol. Add layers. New agent-readable doc surfaces (a vendor publishing an MCP server, a library shipping `SKILL.md`) slot into existing layers without rewriting the rule.

## Notable

- Each layer is more current than the one below it. Intent skills version-lock to installed packages. MCP servers are vendor-maintained.
- Layers degrade gracefully. If Intent has no skill for a package, agents fall through to MCPs; if no MCP, fall through to `llms.txt`; etc.
- TanStack Intent is pre-1.0 (`0.0.x`). The protocol works without it; Intent makes layer 2 better but isn't load-bearing for the rule itself.
- MCP server uptime affects layer 3 in real time. Falls through to (4)/(5) on outage.

## References

- [TanStack Intent](https://tanstack.com/intent)
- [Cloudflare Docs MCP](https://docs.mcp.cloudflare.com/)
- [Microsoft Learn MCP](https://learn.microsoft.com/en-us/training/support/mcp)
- [Context7](https://context7.com/)
- [llms.txt](https://llmstxt.org/)
- [Model Context Protocol](https://modelcontextprotocol.io/)
