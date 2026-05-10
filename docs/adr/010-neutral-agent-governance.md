# ADR-010: Neutral agent governance

![Status](https://img.shields.io/badge/status-Accepted-brightgreen) ![Date](https://img.shields.io/badge/date-2026--05--09-blue)

## Context

Multiple agent harnesses (Claude Code, Codex, Cursor, Aider, etc.) read different files for project context. Writing rules once in a shared location and adapting per harness keeps the rules portable. Bloated rules files get ignored by agents (per [Anthropic's CLAUDE.md guidance](https://code.claude.com/docs/en/best-practices)), so the rules layer is one tight file, not a hub-and-spokes.

## Decision

One canonical rules file plus thin per-harness adapters, and a separate gate layer for per-harness enforcement.

**Rules layer (one file, harness-agnostic):**

- [`AGENTS.md`](../../AGENTS.md) at repo root: the canonical instructions document. Codex, Cursor, Aider, and the [agents.md convention](https://agents.md/) all read this name natively.
- `CLAUDE.md`: a one-line `@AGENTS.md` import. Claude Code reads `CLAUDE.md` natively (not `AGENTS.md`); the import loads AGENTS.md content into Claude Code sessions. Per [Anthropic's memory docs](https://code.claude.com/docs/en/memory).
- `.cursorrules`: thin shim with the highest-priority rules inlined for Cursor's fallback parsing.

**Gate layer (per-harness configuration):**

- `.claude/settings.json`: Claude Code permission allow/deny lists and hook wiring (the `UserPromptSubmit` research-first re-anchor).
- `.mcp.json` at repo root: portable MCP server preconfig (Cloudflare Docs, Microsoft Learn, Context7) that any harness reading `.mcp.json` picks up.
- Other harnesses: same content, different config file syntax; add as needed.

The rules content lives in one place; only the gate-layer config syntax differs by harness. Adding a new harness is a thin shim plus a gate config, not a rewrite.

## Consequences

**Positive:**

- One source of truth for rules (`AGENTS.md`); harness adapters are mechanical.
- AGENTS.md stays under the size that gets ignored. Per Anthropic, bloated CLAUDE.md/AGENTS.md files cause agents to lose track of instructions.
- Domain-specific guidance moves to skills (`.claude/skills/<name>/SKILL.md`) loaded on demand for Claude Code, rather than bloating every session's context.

**Negative:**

- Per-harness gate config has to be maintained per harness when permissions or hooks need wiring. Each harness has its own gate model; no way around this.
- Skills are Claude Code-specific. Other harnesses fall back to AGENTS.md only and don't get the on-demand domain knowledge that skills provide.

**Neutral / trade-off:**

- Cross-harness rules portability is achieved through AGENTS.md being read natively by Codex/Cursor/Aider plus the `CLAUDE.md` import for Claude Code. The agents.md convention specifies AGENTS.md as a dedicated instructions document, not a hub.
