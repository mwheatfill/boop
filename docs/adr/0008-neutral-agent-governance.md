---
title: "ADR-0008: Neutral agent governance (AGENTS.md + agent-rules/)"
type: "Architecture Decision Record"
status: Accepted
date: 2026-05-09
author: "Michael Wheatfill, Cloud & Collaboration Architect"
description: "Rules live in harness-agnostic markdown; gates live in harness-specific configs. AGENTS.md is the canonical entry."
---

# ADR-0008: Neutral agent governance (AGENTS.md + agent-rules/)

## Status

Accepted (2026-05-09)

## Context

Apps cloned from this template will be evolved primarily by AI coding agents — Claude Code, Codex, Cursor, Aider, and harnesses that don't yet exist. Each harness has its own conventions for where to find rules:

- Claude Code reads `CLAUDE.md` and respects `.claude/settings.json`.
- Codex reads `AGENTS.md` natively.
- Cursor reads `.cursorrules` (and the newer `.cursor/rules/*.mdc`).
- Aider reads `CONVENTIONS.md` (configurable).

Putting governance in any single harness's location ties the template to that harness. Future harnesses won't find the rules; switching harnesses requires rewriting.

A second concern: even within a single harness, **rules** (what behavior to follow) and **gates** (what commands the harness allows) are different concerns that should not be conflated. Rules are content; gates are configuration. The right home for each is different.

## Decision

**Rules layer — harness-agnostic markdown:**

- `AGENTS.md` at repo root is the canonical entry point.
- `agent-rules/` (no leading dot) holds individual rule files: `lookup-order.md`, `dependencies.md`, `spec-fidelity.md`, `architecture.md`, `api-contract.md`, `intent.md`, `conventions.md`, `codex-config.md`.
- `CLAUDE.md` is a thin shim pointing at `AGENTS.md`.
- `.cursorrules` is a thin shim with the highest-priority rules inlined as a fallback for Cursor's parsing.

**Gate layer — harness-specific:**

- `.claude/settings.json` for Claude Code: permission allow/deny lists (e.g., `pnpm add` denied so the user prompts on every dep change), MCP server preconfig (Cloudflare Docs, Microsoft Learn, Context7).
- Codex equivalents documented in `agent-rules/codex-config.md`.
- Other harnesses get their gate configs added as needed; the rules layer is unchanged.

## Consequences

**Positive:**

- Cross-harness portability: any agent harness that respects `AGENTS.md` (most modern ones do) finds the rules. Adding a new harness is adding a thin shim, not rewriting.
- Clean separation of concerns: rules are markdown; gates are config. Each lives where it belongs.
- Future-friendly: as the AI coding agent space matures, the template's rule layer ages well.
- Discoverable: `agent-rules/` (no leading dot) shows in default file listings; humans contributing to the codebase see the governance surface.

**Negative:**

- Multiple shim files (`CLAUDE.md`, `.cursorrules`, possibly more) needed for compatibility. Each is small, but they exist.
- Users have to know `AGENTS.md` is the entry. Documented in `README.md`.

**Neutral / trade-off:**

- The reference app (HoopsLoop) uses `.claude/rules/` — a Claude-Code-specific pattern. The template intentionally departs to gain portability. HoopsLoop's pattern is a known-good starting point; the neutral structure is an improvement on top.

## Alternatives considered

- **All in `.claude/rules/` (HoopsLoop's pattern)** — works for Claude Code, ties everything to one harness. Lost on portability.
- **README-only governance** — no structured surface for agents to read; rules get buried in long README sections. Lost on discoverability and per-rule referencing.
- **Per-harness duplication** — same rule content in `CLAUDE.md`, `AGENTS.md`, `.cursorrules`. Maintenance nightmare; rules drift between copies. Lost on maintainability.
- **Single `AGENTS.md` mega-file (no `agent-rules/` directory)** — works but the file gets long (300+ lines). Hard to skim, hard to reference specific sections. Splitting into per-concern files is more agent-friendly.

## References

- [AGENTS.md spec / convention](https://agents.md/) (emerging cross-harness standard)
- [Claude Code settings reference](https://docs.claude.com/en/docs/claude-code/settings)
- [Cursor rules documentation](https://docs.cursor.com/context/rules-for-ai)
- Brief: `claude-code-brief.md`, "Agent governance" section
