# Design direction

The brief for the design-language session. The principle frames the aesthetic; the queued surfaces define the remaining scope; the "Landed" section is the audit trail for what's been settled.

**Decisions land in [`DESIGN.md`](../DESIGN.md) at the repo root.** This file is the brief and the session log; DESIGN.md is the standing operational reference cited by every UI PR.

## Landed

- **Navigation chrome.** Inverted-L sidebar via the shadcn `sidebar` primitive (collapsible-to-icon-rail + mobile drawer), per-detail-route right rail (Job / Run / Customer / Target properties panels), three-icon cluster top-right (filter slot / display options / right-rail toggle), `data-density="compact" | "spacious"` toggle in the display popover, device-local pinning capped at 20 entries that share storage with the Cmd+K palette's recents. Cmd+B toggles the sidebar (canonical shadcn), `]` toggles the right rail, `Shift+P` pins/unpins on Customer / Job detail. DESIGN.md § 4 + § 11 are now standing reference, no longer queued.
- **Pass 2 — Design language baseline.** Dark-first default, three-anchor theme system (`--theme-base`, `--theme-accent`, `--theme-contrast`) with OKLCH relative-color derivations, cool-blue UI accent at hue 240, Linear-orthodox semantic states at low chroma, warm orange brand identity retreats to the chart palette (`--chart-1..3`) plus dashboard accents. See [ADR-022](adr/022-design-language-pass-2.md). Supersedes the warm-orange-as-primary decisions from PR #34 / ADR-021.

## Principle

Lean toward a beautiful, aesthetic, simple UI that doesn't limit function or power.

The audience is developers / IT operators. They expect dense information when they want it, generous whitespace when they don't, and keyboard shortcuts for everything they do more than twice a day. Simple as a default; powerful when invoked.

## Queued surfaces for the design-language session

The original queue is now empty: the Cmd+K palette landed in PR #52, the dashboard composition landed in PR #47, the modal-with-pills create flow landed in PR #47, the nav chrome / density toggle land here. Remaining design questions live in their own PRDs as they surface; the queue below lists the design-direction-level items still open.

- **Template editor upgrade.** PRD #16's slice 2 ships a monospace `<textarea>` + live preview. CodeMirror 6 with a Liquid mode is the design-pass target (separate dep proposal, ~50 KB gzipped, within the 1 MB Workers ceiling).

## Where each item is currently deferred

| Surface | Currently tracked at |
|---|---|
| Template editor upgrade (CodeMirror) | PRD #16 `## Out of Scope` |
| Operator-defined render variables | PRD #16 `## Out of Scope` (needs a schema decision first) |
| Job templates (clone-on-create) | PRD #16 `## Out of Scope` |
| AI authoring hook | PRD #16 `## Out of Scope`, ADR-015 future work |

## How this brief gets used

Read this before starting the design-language session. The principle frames the aesthetic; the queued surfaces define the scope; the cross-reference table is the audit trail for what's been parked and where.

Update this file when the design-language session happens — the principle stays, the queued list shrinks, and items either land as ADRs (e.g., "ADR-NNN: inline-edit-by-default") or get rolled into the implementing PRD.
