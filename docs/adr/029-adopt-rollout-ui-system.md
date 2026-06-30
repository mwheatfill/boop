# ADR-029: Adopt the rollout app's UI system (theme + primitives)

![Status](https://img.shields.io/badge/status-Accepted-brightgreen) ![Date](https://img.shields.io/badge/date-2026--06--28-blue)

## Context

boop and the sibling **rollout** app (`mcc`) share the exact template lineage: Cloudflare Workers + TanStack Start, shadcn `base-vega`, `@base-ui/react` `^1.4.1` (identical pin), the same `components.json`. boop's `button.tsx` is byte-identical to mcc's; the base primitives are in lockstep.

boop's UI pain (broken and ugly pill dropdowns, inconsistent per-form formatting, "all over the place") is an **execution** gap, not a design-language gap. boop hand-rolled `PillButton` / `PillPicker` / `SearchableCombobox` and ad-hoc per-modal label/input/error markup. mcc composes every form from shadcn primitives (`Field`, `Select`, `Combobox`, `InputGroup`) and ships **zero** pill-popover choice inputs.

The theme situation reinforces this. ADR-022 decided a cool-blue UI accent with a warm-orange chart brand at radius `0.5rem` on the system font stack, but `src/styles/app.css` never carried it: it held the stock shadcn **green** theme at radius `0`. mcc carries a validated tweakcn theme (teal primary `#08CDBE`, radius `0.625rem`, Inter/Lora, a full shadow scale, and a `--viz-*` data-viz layer).

ADR-023 set modal-with-inline-pills as the create/edit convention. Those pills are the source of the pain above.

## Decision

Adopt mcc's UI system wholesale. Retain ADR-022's **flat-shadcn-token-contract** principle (it is still the zero-translation refresh path); replace its color, radius, and font specifics with mcc's, and replace the inline-pills form convention with Field-composed forms.

| Concern | Choice | Over |
|---|---|---|
| Theme source | mcc's `app.css`: tweakcn export, teal primary `#08CDBE`, radius `0.625rem` (standard shadcn), Inter/Lora, shadow scale, `--viz-positive/warning/critical/neutral` | boop's stock-green theme; re-deriving a boop-specific palette |
| Accent / brand | **Teal UI accent** (mcc's `#08CDBE`); the orange boop brand lives in the logo + `--chart-1` — a brand-vs-UI-accent split (DESIGN.md § 3). Revives ADR-022's split *shape* (brand ≠ UI accent), with teal UI + orange brand rather than blue UI + orange charts | a single accent doing both brand and UI duty |
| Token contract | Flat shadcn OKLCH per token, `:root` + `.dark`, `@theme inline`. Keep boop's `--info` extension (mcc omits it; badge/JobModal/codemirror use it) | re-introducing a derivation layer |
| Form composition | shadcn `Field` + `Select` / `Combobox` / `InputGroup`, grouped into `Section`s | ADR-023's modal-with-inline-pills; hand-rolled pill inputs |
| Editor surface | Uniform right-side **`Sheet`** for all six entity create/edit; `AlertDialog` for destructive confirms. Plain open/close state (row click / "New"); **no route-masking**. Container + craft rules in `docs/ui-craft.md` (adopted from rollout) | ADR-023's centered modal + `createRouteMask`; the masking's share/refresh `location.state` edge cases |
| Primitives | Pull mcc's base-vega primitives: `field`, `combobox`, `input-group`, `button-group`, `empty`, `breadcrumb` (richer `data-table` in a later phase) | hand-rolling; one-off per-modal markup |
| Drift guard | boop's existing `scripts/audit-patterns/shadcn.ts` (structural registry diff over every `ui/*.tsx`) + `@reui` registry in `components.json` | re-hand-rolling primitives that silently drift |
| Retire | `PillButton`, `PillPicker`, `SearchableCombobox`, `MultiSearchableCombobox`, `SingleSelectPill` | keeping a parallel hand-rolled choice-input system |

**Supersession.** Supersedes ADR-022's theme *values* (accent, brand split, radius, fonts) and ADR-023 (modal-with-pills **and** its route-masking) in full. Retains ADR-022's flat-token contract and light-first CSS / dark-default UX structure. The build-craft conventions live in `docs/ui-craft.md`, adopted wholesale from the rollout app.

**Phased rollout** (each phase ships independently):

1. **Foundations** (this PR): theme swap, the six primitives, `@reui` registry, this ADR, DESIGN.md § 3 + § 6 revisions.
2. **Kill the pills**: rebuild the six entity editors (Job, Target, Channel, AlertRule, Tunnel, Workspace) as uniform right-side `Sheet`s composed of `Field` + `Select` / `Combobox` per `docs/ui-craft.md`; add the shared `Section` component; remove `route-masks.ts` and the masked routes; delete the retired pill primitives.
3. **Lists / shell**: adopt mcc's richer `data-table` + breadcrumb header (adds `@tanstack/react-table` + `@tanstack/react-virtual`).
4. **Finish queued**: shortcuts + motion (DESIGN.md §§ 7–8).

## Consequences

**Positive:**

- boop and rollout share one validated UI system. The pill pain is fixed at the primitive level, once, not per-modal.
- The drift audit already globs `ui/*.tsx`, so the ported primitives are covered the moment they land; they can't silently diverge from the registry.
- The zero-translation shadcn workflow survives intact (still flat tokens, same `@theme inline` mapping).

**Negative:**

- boop loses its distinct brand identity and now looks like rollout. Accepted by the operator (2026-06-28).
- Radius moves from the prior `0` to shadcn's default `0.625rem`; corners soften modestly across every surface. One-time visual churn.
- The theme refresh path moves from `ui.shadcn.com/create` pastes to a tweakcn re-export (or a copy from mcc). DESIGN.md § 3 documents the new path.

**Neutral / trade-off:**

- Lora (serif) is referenced but not bundled, matching mcc; it falls back to system serif unless installed.
- The retired primitives stay on disk until Phase 2 consumes their replacements; foundations only adds, it does not delete.
- Phase 2 shipped: all six editors are Sheets; `EntityModal` survives for `SaveJobTemplateModal` (a quick action dialog, correctly a Dialog). `SearchableCombobox`/`PillPicker`/`combobox-internals` survive transitionally as `TimezoneCombobox`'s engine — follow-up: move `TimezoneCombobox` onto the shadcn `Combobox` and delete those three.
