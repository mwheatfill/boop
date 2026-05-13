# ADR-022: Design language pass 2 (dark-first, three-anchor theme, brand-vs-UI-accent split)

![Status](https://img.shields.io/badge/status-Proposed-yellow) ![Date](https://img.shields.io/badge/date-2026--05--12-blue)

## Context

Pass 1 of the design-language session (PR #34, ADR-021 in flight) put the warm orange brand identity into every chrome slot: primary CTA, focus rings, selected rows, sidebar accents. After working through Linear's published design system and direct screenshots, the cost became clear. Warm orange in the chrome slot competed for attention with every Run-failure state, every active list row, every hover. Linear's pattern is the opposite: monochrome chrome with a single restrained accent for action, and brand colors retreating to charts, illustrations, and marketing.

The brief at `docs/design-direction.md` is anchored Linear-leaning. Three structural choices were left unsettled after pass 1: dark-first vs. light-first default, color restraint policy, and the per-token vs. three-anchor architecture of the token system. This ADR locks all three together because they interact: a dark-first system with one accent is the natural shape of a three-anchor theme, and the boop brand orange becomes the chart palette in that shape.

PR #34's ADR-021 is the historical record of the brand palette as supplied (warm orange `#E27528` family). Its **UI-accent decisions are superseded by this ADR**; its **brand palette content is preserved here as the chart palette**. PR #34 can close without merging.

## Decision

| Concern | Choice | Over |
|---|---|---|
| Default mode | **Dark-first.** `:root` carries dark values; `.light` overrides only the three anchors. `next-themes` `defaultTheme` is `dark`, not `system`. | Light-first (out-of-sync with Linear's pattern, with operator tooling convention, and with the principle in `docs/design-direction.md`). |
| Token architecture | **Four anchors + derivation.** `--theme-base` (background hue), `--theme-accent` (primary action color), `--theme-contrast` (0..1 multiplier for foreground intensity), `--surface-step` (signed lightness lift for derived surfaces; positive in dark, negative in `.light`). Every other token derives via OKLCH relative-color syntax `oklch(from <color> <l> <c> <h>)`; muted foreground uses `color-mix(in oklch, ...)` to sidestep the `l + offset` clamp at near-1.0 bases. | The per-token block from pass 1 (~40 hardcoded values per mode). Linear themselves moved from 98 per-theme variables to 3 because the curated approach drifts under hand-tuning. A first attempt with three anchors and an unsigned surface lift broke light mode: `calc(l + 0.04)` against a 0.985 base clamped at 1.0, collapsing `--card` / `--sidebar` / `--secondary` onto the background. `--surface-step` is the signed lift that fixes it. |
| UI accent | **Cool blue at hue 240.** `oklch(0.68 0.16 240)` dark, `oklch(0.55 0.18 240)` light. Used for focus rings, primary CTAs, selected rows, links, the cmd+K palette highlight. | Warm orange (now retreats to charts/dashboard, see brand-vs-UI split below); indigo at hue 270 (Linear-direct but less distinct in operator-tool space); desaturated charcoal-purple (too quiet for boop's audience). |
| Brand palette location | **Brand palette retreats to chart slots.** The warm orange family (`#E27528`, `#AB5112`, `#FFAE76`) populates `--chart-1..3` with complementary cool blue and green for `--chart-4..5`. The brand identity surfaces in data viz, dashboard tiles, illustrative accents, and marketing. The UI chrome stays monochrome. | One palette doing double duty (brand + UI accent) — the failure mode pass 1 fell into. |
| Semantic states | **Linear-orthodox: low chroma, hue-canonical, restrained.** `success` green at hue 150 / chroma 0.10. `warning` amber at hue 85 / chroma 0.10. `info` blue at hue 235 / chroma 0.10. `destructive` red at hue 25 / chroma 0.15. | Pass 1's higher-chroma states (0.13-0.22); the gold-warning-at-hue-95 was needed only because primary was orange at hue 51. Cool-blue primary at hue 240 leaves canonical warning amber safe. |
| Border / input | **Hairline at low alpha.** Dark: `oklch(1 0 0 / 0.08)`. Light: `oklch(0 0 0 / 0.10)`. | Linear's pattern: structure emerges from border lines, not gaps or shadows. |
| Radius | **Tightened from `0.625rem` to `0.5rem` (10px → 8px).** Reads more disciplined in the dense data surfaces Linear's pattern produces. | `0.625rem` (shadcn default; reads slightly chunky for the density target). |
| Contrast slider semantics | **`--theme-contrast: 0.7` default; range 0..1.** Used as `oklch(from var(--theme-base) calc((1 - l) * var(--theme-contrast) + l * (1 - var(--theme-contrast))) ...)` to compute foreground. At 1.0, foreground sits at perceptually-opposite lightness. At 0.0, foreground equals background (zero contrast). Default `0.7` reads as a tightened-but-comfortable midpoint, comparable to Linear's "high readability without going stark." | Linear's documented 30..100 range (we use 0..1 internally for cleaner CSS calc; the human mapping is the same). |

The anchor system reduces boop's ~40 per-mode CSS variables to **4 anchors + ~25 derivation rules**. Changing any anchor (palette refresh, brand shift, accessibility theme) moves every derived token coherently. Adding a new mode (e.g. a high-contrast theme or a color-blind-safe theme) is a new `.<mode-name>` block that overrides only the anchors.

The base hue is **cool slate at hue 250**, near-neutral at chroma `0.006` dark / `0.004` light. Pass-2-first values lived at hue 28 / hue 50 (warm-leaning) on the assumption that warm neutrals would echo the brand orange. They did, but they also fought the cool-blue accent at hue 240 every time the two sat near each other (focus ring on an input, selected row on a sidebar item). Cool slate sits at the same hue family as the accent without being obviously blue, so the chrome reads as one calm material instead of two competing temperatures.

## Consequences

**Positive:**

- The UI chrome reads monochrome, disciplined, Linear-aligned. Color appears where it carries meaning: states (success/warning/info/destructive), primary action (cool blue), data viz (warm orange chart palette).
- Brand identity is preserved without competing with operational signals. A failing Run shows in destructive red against a monochrome chrome; the warm orange chart palette colors the metric tile underneath. Both are loud where they belong, quiet where they don't.
- The three-anchor system is testable. A theme refresh is three OKLCH values; an accessibility mode is one block override. The maintenance surface shrinks ~10x.
- OKLCH `from`-relative color syntax keeps derivations in CSS, not in TypeScript. No runtime cost, no build-time generation; the browser computes the cascade.
- Dark-first matches the principle in `docs/design-direction.md` and the audience (operators / IT / developers who default-dark across their tools).

**Negative:**

- OKLCH `from` syntax requires Chrome 119+, Safari 16.4+, Firefox 128+. Operators on older browsers see the fallback (the raw oklch values for the anchors, no derivation). The browser support matrix matches what Tailwind v4 already requires, so this adds no new floor.
- Visual diff against pass 1 is total: every shipped component looks different on the deployed dev URL after merge. Slice 1+2 forms, the Jobs-first home, the Customer hub, the Run viewer slice A — all re-render. No code change in those components; the cascade does the work.
- The `--theme-contrast` slider is a knob no UI surface yet exposes. Future-PRD candidate: user-pref toggle for accessibility themes (high-contrast = 0.95, comfortable = 0.7, quiet = 0.5).

**Neutral / trade-off:**

- Pass 1 (PR #34, ADR-021) is superseded by this pass for UI-accent decisions. Its brand-palette content is preserved here as `--chart-1..3`. PR #34 should be **closed without merging**, not merged-then-superseded, to keep the historical record clean.
- The dark-mode `--card` lift of `+0.04` lightness from `--theme-base` is calibrated for the current base value (0.18). If the base moves substantially (e.g., a fully-black-themed mode), the lift may need adjustment. Each `.mode` override block can re-tune the lift if needed.
- Semantic state foregrounds use very-dark variants of the state hue (`oklch(0.18 0.012 <hue>)`), not pure white. Reads as "this color, at this lightness, against this color" rather than a flat layer of white-on-color. Matches Linear's pattern.
- The mappings in `@theme inline` still need to be kept in sync with the `:root` derivations whenever a new token name is introduced. Tailwind v4 does not yet support `--color-<name>` resolution from a CSS-calc'd base; the `@theme inline` block stays.
- ADR-021 stays a Proposed ADR in PR #34's branch. If PR #34 closes, ADR-021 never lands on `main`. The brand palette as a designed artifact is captured here in ADR-022's chart-palette section; ADR-021's PR history (palette derivation, the gold-warning collision discussion, the warm-leaning-neutrals decision) is preserved in the PR conversation thread on GitHub. If you prefer ADR-021 to land for historical record, merge PR #34 first; this ADR works either way.
