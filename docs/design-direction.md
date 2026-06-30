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

## UI reset — align with the rollout app (mcc)

**Decision (locked by the operator):** adopt the UI system from the sibling **rollout** project at `/Users/michael/Code/projects/claude/mcc` (same template family: Cloudflare Workers + TanStack Start, shadcn **base-vega**, Base UI). Theming brought over **wholesale**, including mcc's **teal accent** (`#08CDBE`); ADR-022's cool-blue/warm-orange split is **retired**, not re-applied. See [ADR-029](adr/029-adopt-rollout-ui-system.md).

**Phase 1 (Foundations) — LANDED** on branch `ui-foundations-rollout-theme`: theme swap (mcc `app.css` wholesale, `--info` preserved), six primitives ported (`field`, `combobox`, `input-group`, `button-group`, `empty`, `breadcrumb`), `@reui` registry, deps (`@fontsource-variable/inter`, `tw-animate-css`), ADR-029 (supersedes ADR-022 theme values + ADR-023), DESIGN.md § 2/3/5/6/11 revised, `src/components/ui/**` biome override. Gates green: typecheck, build, `audit:patterns` (incl. shadcn drift), biome. **Next: Phase 2 — kill the pills.**

**Root cause this fixes:** boop's pain (ugly/non-functional pill dropdowns, inconsistent form formatting, "all over the place") is an *execution* gap, not a language gap. boop hand-rolled `PillButton`/`PillPicker`/`SearchableCombobox` and ad-hoc per-modal label/input/error markup; mcc composes from shadcn primitives (`Field`, `Select`, `Combobox`) and uses **zero** pill-popover choice inputs.

**Strategic reversal:** revise `DESIGN.md` § 6 away from "Queued: Linear-style modal-with-inline-pills" toward **Field-composed forms with shadcn `Select`/`Combobox`** (mcc's proven pattern). Write this up as a new ADR (supersede the inline-pills target) before/with the work.

**Retire:** `src/components/forms/PillPicker.tsx`, `PillButton`, `SearchableCombobox.tsx` (replaced by shadcn `Select`/`Combobox` + `Field`).

**Adopt from mcc (base-vega registry primitives mcc already validated):** `field.tsx` (label+description+control+deduped error, orientation-aware), `select.tsx`, `combobox.tsx` (searchable + multi-select chips), `input-group.tsx`, `button-group.tsx`, `empty.tsx`, `breadcrumb.tsx`, and the richer `data-table/` (TanStack Table + Virtual: sort/pin/filter/reorder). Also adopt mcc's **shadcn registry-drift audit** (`scripts/audit-patterns/shadcn.ts` diffs every `ui/*.tsx` against the live base-vega registry) so primitives can't be hand-rolled again — boop's audit currently only checks color classes.

**Phased plan — ALL SHIPPED to prod (v0.1.35–v0.1.40, 2026-06-30):**
1. ~~**Foundations**~~ — DONE. Theme + primitives + `@reui` registry + ADR-029 (v0.1.35–36).
2. ~~**Kill the pills**~~ — DONE. Six editors rebuilt as uniform right-side Sheets on `Field` + `Select`/`Combobox`; all pill primitives deleted (incl. `TimezoneCombobox` moved to the shadcn `Combobox`) (v0.1.36–37).
3. ~~**Lists / shell**~~ — DONE. `DataTable` upgraded on react-table v8 (rollout is v9-beta, so reimplemented, not copied): sort, sticky header, density, search, column show/reorder (dnd-kit), device-local saved views, per-column faceted filters (v0.1.38–39).
4. ~~**Finish queued**~~ — DONE. Shortcuts were already built (`src/components/keyboard/`); added the motion tokens (`--motion-*`, `duration-fast/medium`, `ease-standard`) per DESIGN.md § 8 (v0.1.40). Hover-hint banner deferred (low value). **UI reset complete.**

Concrete mcc pointers: tokens `mcc/src/styles/app.css`; `mcc/src/components/ui/field.tsx`; form exemplar `mcc/src/components/settings/ingestion-card.tsx`; DataTable `mcc/src/components/data-table/data-table.tsx`; viz tokens rationale `mcc/docs/adr/020-data-viz-color-tokens.md`; registry audit `mcc/scripts/audit-patterns/shadcn.ts`.
