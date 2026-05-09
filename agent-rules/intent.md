# TanStack Intent cadence

[TanStack Intent](https://tanstack.com/intent) ships agent-readable skills (SKILL.md files) inside npm packages. When you bump a package version, the skill version moves with it. This solves the "agent uses outdated training data" problem for in-tree libraries that ship skills (TanStack ecosystem today; expanding).

## When to run each command

| Command | When | Why |
|---|---|---|
| `pnpm intent:list` | Session start, read-only | See what skill guidance is available for installed versions |
| `pnpm intent:list:json` | When automating; same as above | JSON output for scripting |
| `npx @tanstack/intent load <pkg>#<skill>` | Per-task, before working on a TanStack-area concern | Read current guidance for the installed version |
| `npx @tanstack/intent install` | After `pnpm install`, after any dep change | Refresh skill bindings in `AGENTS.md` and harness configs |
| `pnpm intent:stale` | Locally before opening a PR; in CI as a soft gate | Catch skill references that fall behind library versions |

## Cadence

**At project bootstrap (one-time, automated by `pnpm bootstrap`):**

```bash
npx @tanstack/intent install
```

This is run by the bootstrap script after `pnpm install`. Don't wire it as a `postinstall` hook until Intent's docs confirm it uses a managed block in `AGENTS.md`; auto-mutating the file is a footgun otherwise.

**After dependency changes** (manual, agent or developer):

```bash
pnpm install                    # or pnpm add / pnpm remove (denied in harness; user prompts)
npx @tanstack/intent install    # refresh skill bindings
```

This is the most-skipped step. After every dep change, refresh.

**Per-task during a session** (agent invokes):

When working on TanStack Router, run:

```bash
npx @tanstack/intent load @tanstack/react-router#routing
```

When working on TanStack Start server functions:

```bash
npx @tanstack/intent load @tanstack/react-start#server-functions
```

The skill content overrides training data. If your training-recall and the loaded skill conflict, the skill is right.

**In CI** (template wires automatically):

```bash
pnpm intent:stale    # soft gate; warns but doesn't block
pnpm openapi:generate && node scripts/check-openapi-contract.mjs    # hard gate
```

`intent:stale` is advisory because skill drift doesn't break the app at runtime; it just means agent guidance might lag. `openapi-contract` is hard because spec drift breaks the API.

**Maintenance (weekly, optional):**

A scheduled GitHub Action runs `pnpm intent:stale` and `pnpm outdated`, opens a PR if either flags. The Renovate config covers most of this; the Intent stale check adds skill-specific awareness.

## Conflict resolution

When sources conflict (training data says X, Intent skill says Y):

1. **Intent skill wins** for the package the skill ships with. The skill version is locked to the installed package version; training data is not.
2. **Configured MCP servers win** over training data for vendors with MCPs (Cloudflare, Microsoft Learn, Context7).
3. **Training data is last resort.** Verify against (1)–(2) before relying on it.

This is the same protocol as `agent-rules/lookup-order.md` — Intent is step 2 in the lookup order.

## What Intent doesn't cover

Intent only helps with libraries that ship `SKILL.md` files. Right now, that's mostly TanStack:

- `@tanstack/react-router`
- `@tanstack/react-start`
- `@tanstack/react-query`
- `@tanstack/react-form`
- `@tanstack/react-table`
- `@tanstack/react-virtual`

For everything else, fall back to:

- **MCP servers** (Cloudflare Docs, Microsoft Learn, Context7) — preconfigured in `.claude/settings.json`
- **`llms.txt`** at the vendor domain
- **Vendor official docs** via WebFetch
- See `agent-rules/lookup-order.md` for the full protocol.

## Don't hand-edit Intent-managed sections

If `intent install` writes content into `AGENTS.md` or another config file, treat that section as managed. Don't hand-edit; re-run `intent install` to update.

If Intent's behavior changes (e.g., starts overwriting `AGENTS.md` wholesale), back off the auto-install and document a manual cadence in `README.md` until the situation clarifies. The lookup-order protocol works without Intent (steps 1, 3, 4, 5 still do useful work), so this isn't fatal.
