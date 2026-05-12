# ADR-021: Brand color palette (warm orange primary, warm-leaning neutrals, gold-shifted warning)

![Status](https://img.shields.io/badge/status-Proposed-yellow) ![Date](https://img.shields.io/badge/date-2026--05--12-blue)

## Context

ADR-008 settled the visual layer on shadcn-base-vega with `baseColor: neutral`. That shipped a pure-neutral, near-monochrome token block (the shadcn default). With slice 1 and slice 2 of the Job UI now on `main` (PRs #22, #26, #28), the app has its first real Operator surfaces, and the absence of a brand identity is visible: every primary CTA is near-black on white, focus rings are gray, and there is no semantic distinction between "alert" states. The design-direction brief at `docs/design-direction.md` queued a design-language session to settle this.

Two collision points constrain any palette choice:

- The brand name `boop` is playful (soft consonants, doubled vowels) while the product is serious infrastructure monitoring at scale. The palette has to honor both without flattening the tension into pure-corporate or pure-cute.
- Operator tooling lives or dies on at-a-glance state distinction. `success`, `warning`, `info`, and `destructive` semantic colors must be unambiguously different from the brand primary even at a glance in a sidebar dot or a row indicator.

## Decision

Adopt a warm orange brand palette with warm-leaning neutrals and a gold-shifted warning that dodges the brand's orange hue. Concretely (hex source → OKLCH, the project's token color space):

| Token | Hex | OKLCH (light) | OKLCH (dark) |
|---|---|---|---|
| Primary brand | `#E27528` | `0.676 0.160 50.9` | `0.760 0.155 52` (lifted for dark surfaces) |
| Primary hover | `#AB5112` | `0.539 0.136 49.1` | `0.840 0.135 55` (lighter in dark = visually "more pressed") |
| Primary muted (active row tint) | `#FFAE76` | `0.817 0.119 54.9` | `0.300 0.060 50` (deep warm wash) |
| Text / charcoal foreground | `#231514` | `0.214 0.023 23.7` | `0.960 0.005 60` (warm off-white inverse) |
| Background | `#F9F9F9` shifted to chroma 0.003 | `0.982 0.003 50` | `0.180 0.012 28` (deeper than charcoal, still warm) |
| Surface (card) | `#FFFFFF` | `1.000 0 0` | `0.220 0.012 28` |
| Border | `#EFEFEF` shifted to chroma 0.005 | `0.952 0.005 50` | `1 0 0 / 8%` (hairline white-on-dark) |

| Semantic state | OKLCH (light) | OKLCH (dark) | Rationale |
|---|---|---|---|
| `success` | `0.62 0.14 150` | `0.72 0.13 150` | Green (hue 150), well-distinct from primary orange (hue 51). |
| `warning` | `0.78 0.13 95` | `0.85 0.12 95` | Gold-yellow (hue 95), pushed +44° from primary so it reads distinctly different at small sizes. Canonical "warning amber" sits at hue ~75 and would collide with the primary; rejected. |
| `info` | `0.58 0.15 235` | `0.70 0.14 235` | Cool blue (hue 235), maximum chromatic distance from primary. |
| `destructive` | `0.55 0.22 22` | `0.65 0.20 22` | Cool red (hue 22), distinct from primary's warm orange (hue 51). Higher chroma than charcoal (which sits at the same hue family but lower chroma + lightness). |

| Concern | Choice | Over |
|---|---|---|
| Neutral warmth coherence | **Sub-perceptual chroma on background/border (`0.003`–`0.005` at hue 50)** so the system reads as warm even where the warmth is invisible. | Pure chroma-0 neutrals (background and orange would visually fight; system would read as "monochrome with one orange thing bolted on"). |
| Warning vs primary collision | **Gold at hue 95** (44° away from primary). | Canonical amber at hue 75 (8° away, collides at glance distance); dropping warning's color entirely (loses at-a-glance triage which is the whole point of operator tooling); desaturated muted warning (would read as "disabled" not "alert"). |
| Sidebar tokens | **Recalibrated to brand palette** so `npx shadcn@latest add sidebar` and the dashboard-01 block work out-of-the-box without further tuning. | Leaving shadcn defaults (would visually break the moment sidebar lands). |
| Chart palette | **Chart-1 anchors to primary brand; chart-2..5 are complementary hues from the semantic states.** | Re-tuning later when actual charts ship (would mean either charts ship visually broken or the first chart-shipping PR has to negotiate a separate palette decision). |
| Radius, type scale, motion tokens, density tokens | **Out of scope for ADR-021.** Future ADRs land each when there is consumer code that requires them. | Pre-shipping speculative tokens with no consumers (per AGENTS.md "Don't add features beyond what the task requires"). |

## Consequences

**Positive:**

- Primary CTAs, focus rings, selected rows, and the cmd+K palette (when it ships) all have a brand identity. The Operator's "this is my tool" signal is real.
- The warm palette signals warmth without sacrificing seriousness. The doubled tension in the brand name is honored by the type+spacing remaining disciplined while the orange carries the warmth.
- Semantic states are unambiguous at glance distance. `warning` will not be mistaken for `primary` in any common surface (row indicator, sidebar dot, button border).
- The OKLCH-native token block keeps the existing Tailwind v4 + shadcn convention intact; no migration cost.

**Negative:**

- Orange-as-primary is rare in operator tooling (the genre defaults to blue or indigo). Operators new to boop will need a moment to map "orange button = primary action" rather than "warning." The trade-off is intentional: distinctive brand vs. genre conformity.
- The chart palette is a placeholder. The first PRD that ships charts will need to validate that the five hues read distinctly when stacked in a Recharts line chart, and may need to retune chart-2..5. Captured as a known follow-up, not a regression.
- The sidebar is recalibrated but no sidebar exists yet. The values are validated by inspection only; the first PRD that introduces a sidebar will likely refine.

**Neutral / trade-off:**

- The dark-mode mapping was derived (not vendor-supplied) from the light palette: lift the primary's lightness so it pops on dark surfaces, drop chroma on semantic states slightly for eye-comfort. Linear-leaning convention. Concrete dark values may need to be re-tuned once they are seen in a deployed dev preview against real content.
- `accent` in the token block is now used in a richer way (a faint warm tint, not a duplicate of `secondary`). Existing shadcn components that reference `--accent` (e.g., hover backgrounds on items in dropdowns) will get a subtle peach wash. This is intended; any component where it looks wrong is a per-component allowlist call.
- Future passes of the design language session (density, motion, type scale, radius adjustment, dashboard composition, cmd+K palette, single-key shortcuts, template editor upgrade) inherit this palette but make no decisions about it. The principle stays; new decisions land as their own ADRs.
