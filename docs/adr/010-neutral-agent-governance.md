# ADR-010: Neutral agent governance (AGENTS.md + agent-rules/)

![Status](https://img.shields.io/badge/status-Accepted-brightgreen) ![Date](https://img.shields.io/badge/date-2026--05--09-blue)

## Context

Multiple agent harnesses (Claude Code, Codex, Cursor, Aider, etc.) read different files for project context. Writing the same rules in `CLAUDE.md`, `AGENTS.md`, `.cursorrules`, and Codex configs duplicates content and rots independently in each. Splitting the substance from the per-harness wiring keeps the rules portable across harnesses without N copies.

## Decision

Two layers:

**Rules layer (harness-agnostic markdown):**

- [`AGENTS.md`](../../AGENTS.md) at repo root: canonical entry for any agent harness.
- [`agent-rules/`](../../agent-rules/) (no leading dot): individual rule files (`lookup-order.md`, `dependencies.md`, `architecture.md`, `api-contract.md`, `intent.md`, `conventions.md`, `observability.md`, `preferences.md`).
- `CLAUDE.md`: thin shim pointing at `AGENTS.md`.
- `.cursorrules`: thin shim with the highest-priority rules inlined.

**Gate layer (per-harness configuration):**

- `.claude/settings.json`: Claude Code permission allow/deny lists and hook wiring.
- `.mcp.json` at repo root: portable MCP server preconfig (Cloudflare Docs, Microsoft Learn, Context7) that any harness reading `.mcp.json` (Claude Code, Codex via the appropriate adapter) picks up.
- Other harnesses: same content, different config file syntax; add as needed.

The rules content is portable; only the gate-layer config syntax differs by harness. Adding a new harness is a thin shim plus a gate config, not a content rewrite.

## Consequences

**Positive:**

- One source of truth for rules (the markdown in `agent-rules/`); per-harness adapters are mechanical.
- AGENTS.md is the cross-harness convention: Codex reads it natively; Claude Code via the `CLAUDE.md` shim; Cursor via `.cursorrules` shim; Aider configurable.

**Negative:**

- Per-harness gate config still has to be maintained per harness when permissions or hooks need wiring (e.g., Claude Code hooks live in `.claude/settings.json`). No way around this: each harness has its own gate model.

**Neutral / trade-off:**

- MCP servers moved out of `.claude/settings.json` into `.mcp.json` so they're portable. This trade is net-positive but means Claude-Code-specific MCP setup (per-tenant MCPs, etc.) is a separate consideration if it ever applies.
