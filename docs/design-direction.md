# Design direction

The brief for the design-language session. Not an ADR for the principle itself (which is directional, not decisional), not domain language (so not in `CONTEXT.md`), not an agent operating instruction (so not in `AGENTS.md`). A standing reference that each session picks up from.

The session has started. The principle frames the aesthetic; the queued surfaces define the remaining scope; the "Landed" section is the audit trail for what's been settled.

## Landed

- **Pass 2 — Design language baseline.** Dark-first default, three-anchor theme system (`--theme-base`, `--theme-accent`, `--theme-contrast`) with OKLCH relative-color derivations, cool-blue UI accent at hue 240, Linear-orthodox semantic states at low chroma, warm orange brand identity retreats to the chart palette (`--chart-1..3`) plus dashboard accents. See [ADR-022](adr/022-design-language-pass-2.md). Supersedes the warm-orange-as-primary decisions from PR #34 / ADR-021.

## Principle

Lean toward a beautiful, aesthetic, simple UI that doesn't limit function or power.

The audience is developers / IT operators. They expect dense information when they want it, generous whitespace when they don't, and keyboard shortcuts for everything they do more than twice a day. Simple as a default; powerful when invoked.

## Queued surfaces for the design-language session

When this session happens, these are the surfaces it should design as a coherent system rather than piecewise:

- **Cmd+K palette.** Jump to Customer, jump to Job, Run now, pause/resume by slug. Indexes Jobs and Runs across all Customers (per ADR-018's Jobs-first navigation principle). Customer is a filter, not a navigation gate.
- **Single-key shortcuts.** Developer/IT muscle memory: `r` Run now from a Job detail page, `p` pause, `g j` go-to-jobs, `g c` go-to-customers, `g h` go-to-home. Visible in a `?` cheatsheet overlay.
- **Inline edit vs drawer vs separate page.** Currently every edit ships as a separate `/edit` route (PRD #16). The design pass should settle the convention across entity types — inline is more modern, drawer is more focused, separate-page is the simplest implementation. Pick one (or a rule for when each).
- **Modal vs drawer for create flows.** Currently every create ships as a separate `/new` route. Same trade-off as edit.
- **Density.** Compact rows for power users, spacious default. Probably a single toggle in user prefs.
- **Dashboard composition.** PRD #16 ships the home page as a flat Jobs table (Q14-A). The design pass should expand it: stat tiles, "needs attention" rollups, recent failures, upcoming fires. Cross-cutting view that doesn't drag in scope creep during slice 2.
- **Template editor upgrade.** PRD #16's slice 2 ships a monospace `<textarea>` + live preview. CodeMirror 6 with a Liquid mode is the design-pass target (separate dep proposal, ~50 KB gzipped, within the 1 MB Workers ceiling).

## Where each item is currently deferred

| Surface | Currently tracked at |
|---|---|
| Cmd+K palette | PRD #16 `## Out of Scope` + ADR-018 future-surfaces note |
| Single-key shortcuts | PRD #16 `## Out of Scope` |
| Inline edit / drawers | PRD #16 `## Out of Scope` ("design-language session") |
| Modal vs drawer for create | implicit in PRD #16's "separate `/new` routes" decision |
| Density | not yet tracked |
| Dashboard composition (stat tiles, rollups) | PRD #16 `## Out of Scope` (14-B / 14-C alternatives) |
| Template editor upgrade (CodeMirror) | PRD #16 `## Out of Scope` |
| Operator-defined render variables | PRD #16 `## Out of Scope` (needs a schema decision first) |
| Run detail page | PRD #16 `## Out of Scope` |
| `/runs` cross-cutting view | PRD #16 `## Out of Scope` (slice 3 of this product area) |
| Job templates (clone-on-create) | PRD #16 `## Out of Scope` |
| AI authoring hook | PRD #16 `## Out of Scope`, ADR-015 future work |

## How this brief gets used

Read this before starting the design-language session. The principle frames the aesthetic; the queued surfaces define the scope; the cross-reference table is the audit trail for what's been parked and where.

Update this file when the design-language session happens — the principle stays, the queued list shrinks, and items either land as ADRs (e.g., "ADR-NNN: inline-edit-by-default") or get rolled into the implementing PRD.
