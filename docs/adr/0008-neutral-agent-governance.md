---
title: "ADR-0008: Neutral agent governance (AGENTS.md + agent-rules/)"
type: "Architecture Decision Record"
status: Accepted
date: 2026-05-09
description: "Rules layer is harness-agnostic markdown; gate layer is per-harness configuration."
---

# ADR-0008: Neutral agent governance (AGENTS.md + agent-rules/)

## Status

Accepted (2026-05-09)

## What

Two-layer governance:

**Rules layer (harness-agnostic markdown):**

- `AGENTS.md` at repo root — canonical entry for any agent harness
- `agent-rules/` (no leading dot) — individual rule files: `lookup-order.md`, `dependencies.md`, `spec-fidelity.md`, `architecture.md`, `api-contract.md`, `intent.md`, `conventions.md`, `codex-config.md`
- `CLAUDE.md` — thin shim pointing at `AGENTS.md`
- `.cursorrules` — thin shim with the highest-priority rules inlined

**Gate layer (per-harness configuration):**

- `.claude/settings.json` — Claude Code permission allow/deny lists and MCP server preconfig
- Codex equivalents documented in `agent-rules/codex-config.md`
- Other harnesses: same content, different config file syntax; add as needed

## When this default is right

Always. This is template-mandatory.

## When to switch

Don't. Rules and gates serve different purposes; don't conflate them. Adding a new harness is a thin shim plus a gate config, not a rewrite.

## Notable

- `AGENTS.md` is the cross-harness convention: Codex reads it natively; Claude Code via `CLAUDE.md` shim; Cursor via `.cursorrules` shim; Aider configurable.
- The rules content is portable. Only the gate-layer config syntax differs by harness.
- Pre-configured MCP servers (Cloudflare Docs, Microsoft Learn, Context7) are wired in `.claude/settings.json` and documented for Codex in `agent-rules/codex-config.md`.

## References

- [AGENTS.md convention](https://agents.md/)
- [Claude Code settings reference](https://docs.claude.com/en/docs/claude-code/settings)
- [Cursor rules documentation](https://docs.cursor.com/context/rules-for-ai)
