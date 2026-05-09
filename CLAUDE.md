# CLAUDE.md (compatibility shim)

This repo's instructions live in [`AGENTS.md`](AGENTS.md). Read it first.

`AGENTS.md` is the canonical entry point for every agent harness. Cross-harness governance lives in [`agent-rules/`](agent-rules/). Claude Code-specific permissions and MCP preconfig live in [`.claude/settings.json`](.claude/settings.json).

This file exists so older Claude Code versions and harness defaults that look for `CLAUDE.md` find a pointer rather than nothing. Don't add rules here; add them to `agent-rules/` and reference them from `AGENTS.md`.
