# ADR-022: Design language — canonical shadcn flat tokens on `base-vega` Base UI

![Status](https://img.shields.io/badge/status-Superseded-lightgrey) ![Date](https://img.shields.io/badge/date-2026--05--14-blue)

> Superseded by [ADR-029](029-adopt-rollout-ui-system.md) (2026-06-28). The flat-shadcn-token contract and light-first/dark-default structure below are carried forward; the accent (cool blue), brand-vs-UI-accent split, radius (`0.5rem`), and system font stack are replaced by the rollout app's teal theme. The `--success` / `--warning` / `--info` extensions remain.

## Context

boop is a Cloudflare Workers + TanStack Start prototype. The UI is built from shadcn's Base UI family (`base-vega`), and `@base-ui/react` primitives wired through `src/components/ui/`. The goal of the design system is mechanical: it should be **trivial to pull in shadcn components, blocks, and themes without translation**.

An earlier revision of this ADR layered a four-anchor OKLCH derivation system (`--theme-base`, `--theme-accent`, `--theme-contrast`, `--surface-step`) on top of shadcn's token contract, with every per-token value derived via `oklch(from <color> calc(l + step) c h)`. The maintenance idea was elegant: change one anchor, every derived token follows. The cost showed up in practice:

- shadcn's theme generator (`ui.shadcn.com/create`) emits flat OKLCH per token, in a `:root` (light) + `.dark` structure. Adopting a new theme required hand-translating it through the anchor system.
- shadcn blocks ship colors calibrated against flat-token assumptions. Feeding them derived values produced subtle calibration drift.
- The derivation system added rules to memorize (`l + offset` clamps near 1.0; `color-mix` for muted foreground; signed `--surface-step` for `.light`) that have no analogue in any documentation outside this repo.

shadcn's December 2025 changelog introduced five Base-UI-backed visual styles (`base-vega`, `base-nova`, `base-maia`, `base-lyra`, `base-mira`). All five share the same flat-token theme contract. `base-vega` is the canonical-look style of that family and what `components.json` already targets.

## Decision

| Concern | Choice | Over |
|---|---|---|
| Style | **`base-vega`** in `components.json`. Locked. Base UI primitives via `@base-ui/react`. | `new-york` (Radix-based; conflicts with the Base UI standardization in ADR-008) and other `base-*` styles (different visual character; revisit only if the aesthetic target shifts). |
| Token contract | **Canonical shadcn flat OKLCH per token.** No derivation, no anchors. Every token has a value in `:root` and `.dark`. The `@theme inline` block maps each `--<token>` to `--color-<token>` for Tailwind v4. | Four-anchor + OKLCH `from`-relative derivation. The derivation was elegant in isolation but added a translation step to every paste from `ui.shadcn.com/create`, every shadcn block install, and every future style swap. |
| Mode structure | **Light-first CSS, dark-default UX.** `:root` carries light values; `.dark` overrides. Matches the shape `shadcn-create` emits, so theme pastes are verbatim. `next-themes` `defaultTheme="dark"` keeps the user-facing default unchanged. | Dark-first CSS (`:root` = dark, `.light` override) — readable enough but requires inverting every shadcn paste before use. |
| Brand-vs-UI-accent | **Convention, not derivation.** Warm orange brand (`#E27528` family) lives in `--chart-1..3`. UI accent (focus rings, primary CTAs, selected rows, links, cmd+K highlight) is `--primary` — currently cool blue at hue 240. Changing `--primary` is a single-line theme edit; it does not need a derivation layer to enforce. | Encoding the split as `--theme-accent` (UI) vs the chart palette (brand) in CSS. The intent is preserved, the implementation is simpler. |
| Project token extensions | **Three additions to the shadcn canonical set: `--success`, `--warning`, `--info`** (matched foreground tokens). Defined in `:root` and `.dark`, mapped through `@theme inline`. | Pulling these in from a third-party scale (Radix Colors etc.) — would introduce a parallel token system that does not compose with shadcn's. |
| Scope | **Strip to canonical shadcn + the three semantic-state extensions + the brand chart palette.** No density toggle, no right-rail/properties-panel system, no project-specific layout tokens. Add such features back via shadcn blocks or new components when the product needs them. | Carrying the density and right-rail systems through the prototype phase — neither earned its cost yet. |
| Radius | `0.5rem` (8px). Reads tighter than shadcn's default. | shadcn default `0.625rem` (10px). |
| Semantic state values | Low chroma, hue-canonical: `success` hue 150 / chroma 0.10–0.12; `warning` hue 85 / chroma 0.10–0.13; `info` hue 235 / chroma 0.10–0.13; `destructive` hue 25 / chroma 0.15–0.18. Recalibrated per mode for contrast. | Higher-chroma states — fight the monochrome chrome. |
| Border / input | Hairline at low alpha. Light: `oklch(0 0 0 / 0.10)`. Dark: `oklch(1 0 0 / 0.08)`. | Solid grey borders — heavier than the dense-row aesthetic wants. |

## How this is used day-to-day

**Theme refresh.** Open [`ui.shadcn.com/create`](https://ui.shadcn.com/create), pick or tune a theme, copy the CSS block, paste into `src/styles/app.css` over the existing `:root` + `.dark` blocks. Re-add the three project extensions (`--success`, `--warning`, `--info` and their foregrounds) if the paste removed them. Re-add the density token block. Done.

**Add a shadcn component.** `pnpm dlx shadcn@latest add <component>`. The CLI honors `components.json` (`base-vega`, alias `@/components/ui`), pulls the canonical Base UI implementation, drops it into `src/components/ui/`. Tokens resolve against the project's flat values.

**Add a shadcn block.** `pnpm dlx shadcn@latest add <block-url>`. Same path. Blocks reference token classes (`bg-card`, `text-primary`, …) which resolve identically across styles.

**Change a single brand color.** Edit the relevant CSS var in `:root` and `.dark`. No cascade to trace.

## Consequences

**Positive:**

- Zero-translation workflow for shadcn theme pastes, component adds, and block installs. The friction the derivation layer added is removed.
- Token names are a 1:1 superset of shadcn's canonical contract. Anyone joining the project who knows shadcn knows boop's token system.
- `src/styles/app.css` is short and obvious: two flat blocks (`:root`, `.dark`), one `@theme inline` mapping, one density block. No `oklch(from ...)` calls, no `color-mix` workarounds, no `--surface-step` sign-flip explanation.
- The DESIGN.md § 12 audits (no palette classes, no arbitrary colors, no JSX hex) keep their teeth — those enforce *bypass discipline*, which is orthogonal to flat vs. derived.

**Negative:**

- The "change one anchor and every surface re-derives coherently" property is gone. Mode-level color refreshes mean editing ~30 values per mode instead of 4. Mitigation: pastes from `shadcn-create` are the supported refresh path; the values come pre-computed.
- The supersession of the previous revision is in-place, not as a separate ADR. Acceptable for a prototype; if this codebase later goes through stakeholder review, the previous revision is recoverable from `git log -- docs/adr/022-design-language-pass-2.md`.

**Neutral / trade-off:**

- The dark-first vs. light-first CSS structure is a stylistic preference once you accept that `next-themes` controls the user-facing default. Light-first matches shadcn-create's emission shape; dark-first matched Linear's convention. Going with shadcn-create alignment because pastes are the high-frequency operation.
- The brand-vs-UI-accent split remains a real product decision (operators see one color carry one meaning). It just doesn't need a derivation layer to enforce — it lives in DESIGN.md § 3 and is reviewed at PR time, not encoded as a CSS constraint.
- ADR-021's brand palette (warm orange `#E27528` family) lives in `--chart-1..3` as designed. PR #34 stays closed without merging; the palette content is captured here and in `src/styles/app.css`.
