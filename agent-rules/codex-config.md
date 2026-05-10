# Codex configuration (equivalent to `.claude/settings.json`)

Codex (OpenAI's coding agent) reads `AGENTS.md` natively, so the rule layer in this repo applies unchanged. The gate layer (permissions, MCP server preconfig) has a different shape.

This file documents the Codex equivalents. **Verify against current Codex docs before relying on specifics**, as Codex's configuration surface evolves quickly. The structure of this file is stable; the exact flag names and config locations may not be.

## Sandbox / permissions

Codex runs commands inside a sandbox. The `.claude/settings.json` allow / deny lists in this repo correspond to Codex sandbox modes:

- **`--workspace-write`** (Codex's default for trusted projects): allows file edits and most reads. Equivalent to the read-only and idempotent commands in our Claude Code allow-list.
- **`--read-only`**: for inspection-only sessions. No equivalent needed in this template's day-to-day work.
- **Approval prompts**: Codex prompts the user before executing potentially destructive commands. The deny-list in `.claude/settings.json` (e.g., `pnpm add`, `pnpm remove`, `git push --force`, `wrangler deploy`) maps to commands Codex should require approval for.

Recommended Codex invocation for this repo:

```bash
codex --workspace-write --approve-for "pnpm add,pnpm remove,pnpm update,pnpm uninstall,wrangler deploy,wrangler secret put,git push --force,git reset --hard"
```

The exact flag syntax depends on the Codex version. Check `codex --help` for current spelling.

## MCP servers

The `.claude/settings.json` `mcpServers` block configures three pre-wired MCP servers:

- `cloudflare-docs` at `https://docs.mcp.cloudflare.com/mcp`
- `microsoft-learn` at `https://learn.microsoft.com/api/mcp`
- `context7` at `https://mcp.context7.com/mcp`

For Codex, MCP servers configure in one of:

- `~/.codex/config.toml` (per-user) under `[mcp_servers.<name>]` blocks
- A project-level config file (varies by Codex version)
- Per-session CLI flags

Recommended `~/.codex/config.toml` entries:

```toml
[mcp_servers.cloudflare-docs]
type = "http"
url = "https://docs.mcp.cloudflare.com/mcp"

[mcp_servers.microsoft-learn]
type = "http"
url = "https://learn.microsoft.com/api/mcp"

[mcp_servers.context7]
type = "http"
url = "https://mcp.context7.com/mcp"
```

These match the Claude Code preconfig so agents on either harness reach for the same documentation surface.

## Session bootstrap

Codex agents joining this repo should:

1. Read `AGENTS.md` (Codex does this automatically when present).
2. Run `pnpm intent:list` to enumerate available skill guidance.
3. Verify MCP servers are configured (`codex mcp list` or equivalent).

If MCP servers aren't configured, the lookup order falls through to `llms.txt` and vendor docs (steps 4 and 5 in `agent-rules/lookup-order.md`). The protocol degrades gracefully.

## Codex-specific notes

- Codex's command approval is per-session by default. Long-running sessions may approve `pnpm add` once and then run it freely; this isn't a per-invocation prompt like Claude Code's. Compensate by following `agent-rules/dependencies.md` (propose-before-add) more strictly.
- Codex doesn't have a Claude Code-equivalent `.cursorrules` shim mechanism. The `.cursorrules` file in this repo is for Cursor compatibility, not Codex.
- Codex respects `.gitignore` for sandbox boundaries; sensitive files (e.g., `.dev.vars`) are protected by being in `.gitignore`.

## When Codex docs change

If Codex's configuration surface changes (new flag names, new config file location, etc.), update this file. The rule layer (`agent-rules/*.md` other than this file) is harness-agnostic and doesn't need changes.

## Sources

- Codex official docs: <https://platform.openai.com/docs/codex>
- Verified against the live docs at scaffold time.
- For any current discrepancy, the live docs win. Update this file with a PR.
