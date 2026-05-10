# ADR-011: Skill currency protocol (Intent + MCP)

![Status](https://img.shields.io/badge/status-Accepted-brightgreen) ![Date](https://img.shields.io/badge/date-2026--05--09-blue)

## Context

Library APIs change; agent training data goes stale. Without a stated protocol, agents reach for whichever syntax their training memorized, often a major version behind, sometimes for a deprecated package the vendor has since superseded. Apps that wire the new syntax against the new package (or the old syntax against the new package) break in non-obvious ways at runtime. A layered protocol makes the resolution path deterministic and pushes the most current source to the top.

## Decision

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

`@tanstack/intent` is installed as a devDep. MCP servers are pre-configured in `.mcp.json` per [ADR-010](010-neutral-agent-governance.md). Cadence rules for Intent live in [`agent-rules/intent.md`](../../agent-rules/intent.md).

## Consequences

**Positive:**

- Each layer is more current than the one below it. Intent skills version-lock to installed packages; MCP servers are vendor-maintained.
- Layers degrade gracefully: if Intent has no skill for a package, agents fall through to MCPs; if no MCP, fall through to `llms.txt`; etc.
- New agent-readable doc surfaces (a vendor publishing an MCP, a library shipping `SKILL.md`) slot into existing layers without rewriting the rule.

**Negative:**

- TanStack Intent is pre-1.0 (`0.0.x`); the protocol works without it but layer 2 is weaker until Intent stabilizes.
- MCP server uptime affects layer 3 in real time; outages fall through to (4)/(5).

**Neutral / trade-off:**

- Don't switch the protocol; add layers. Replacing the lookup-order is rarely the right move; adding a new layer (e.g., a `SKILL.md` package convention beyond TanStack) usually is.
