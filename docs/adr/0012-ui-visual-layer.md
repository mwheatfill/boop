---
title: "ADR-0012: UI / visual layer"
type: "Architecture Decision Record"
status: Accepted
date: 2026-05-10
author: "Michael Wheatfill, Cloud & Collaboration Architect"
description: "shadcn/ui (base-vega style) is the center of the visual layer; charts, toasts, icons, animation, dashboard, theme, and class merging all follow from it."
---

# ADR-0012: UI / visual layer

![Status](https://img.shields.io/badge/status-Accepted-brightgreen) ![Date](https://img.shields.io/badge/date-2026--05--10-blue)

> [!NOTE]
> **Accepted** · 2026-05-10

## Context

The visual layer spans every UI surface in the template (primitives, headless, charts, animation, toasts, icons, dashboard, theme, class merging, fonts). Without a stated thesis tying them together, each addition gets evaluated in isolation, inviting best-of-breed drift (a Plotly chart here, a Tabler icon set there) that fragments the layer over time. The UI surface is the most agent-touched code in the repo, so coherence here compounds the longest.

## Decision

[shadcn/ui](https://ui.shadcn.com/docs) (style `base-vega`) is the center. Every other UI choice is either shipped by shadcn, used by shadcn examples, or the React-ecosystem default that integrates with shadcn's CSS-variable theming. Tailwind v4 is the substrate this layer renders into; its choice belongs to a future "Styling" ADR. Detailed base-vega vs radix-* rationale: [ADR-0011 Notable §3](0011-opinionated-stack-and-pattern-enforcement.md#notable).

| Concern | Choice | Over |
|---|---|---|
| Primitives | shadcn/ui (`base-vega`), CLI-vendored via `npx shadcn@latest add <component>` | Material UI, Mantine, Chakra (each duplicates theme plumbing; no live-registry source for the audit to ground in) |
| Headless | [Base UI](https://base-ui.com/) (`@base-ui/react`); compose via `render` prop, not `asChild`/`Slot` | Radix, Headless UI (locked downstream of base-vega style) |
| Charts | [shadcn Chart](https://ui.shadcn.com/docs/components/chart) on Recharts v3, via [`charts/setup`](https://github.com/mwheatfill/app-platform-recipes/tree/main/recipes/charts/setup) recipe | Chart.js (canvas, no React composition); Victory (stagnant); Plotly (scientific viz, heavy); Nivo (no shadcn integration); ECharts (Apache, not React-native) |
| Animation | `motion` (formerly Framer Motion), planned [`motion/setup`](https://github.com/mwheatfill/app-platform-recipes/tree/main/recipes/motion/setup) recipe; CSS / Tailwind transitions for simple cases | react-spring (post-rebrand maintenance slowing); GSAP (paid-tier license, not React-idiomatic) |
| Toasts | shadcn Sonner; template ships `<Toaster />` in `__root.tsx`; app code calls `toast.success(...)` from `'sonner'` | react-toastify, react-hot-toast, notistack (re-implement theme plumbing) |
| Icons | `lucide-react` | Heroicons (smaller set); react-icons (aggregator bloat); Tabler (not the shadcn default) |
| Dashboard | planned [`dashboard/scaffold`](https://github.com/mwheatfill/app-platform-recipes/tree/main/recipes/dashboard/scaffold) recipe (`npx shadcn@latest add dashboard-01`) | Hand-rolled sidebar + chart layouts |
| Theme | `next-themes` | Hand-rolled context (loses hydration safety, system-pref detection) |
| Class merging | `cn()` from `@/lib/utils` (`clsx` + `tailwind-merge`) | Bare `clsx` (loses Tailwind conflict resolution); template-literal concatenation (silent class collisions) |
| Fonts | System stack default; per-app override pattern: `pnpm add @fontsource-variable/<name>` + `@import` in `app.css` + `--font-sans` in `@theme inline` | Google Fonts CDN (privacy); `next/font` (Next-only); Cloudflare Fonts (proxied zones only) |

## Consequences

**Positive:**

- One canonical upstream (shadcn) for every UI surface where shadcn ships an answer; `pnpm audit:patterns` drift detection points at one live registry, not N library snapshots.
- Theme tokens, dark mode, RTL, and motion-reduce wiring stay consistent across surfaces.
- Recipes that add UI surface inherit the same defaults; cross-recipe visual coherence is automatic.

**Negative:**

- Best-of-breed loss per choice. Apps needing real-time ECharts or scientific Plotly hit the shadcn Chart ceiling and need an ADR to deviate.
- shadcn upstream risk. If shadcn changes direction, the audit flags drift and we react. Mitigation: drift surfaces at PR time, not months later.

**Neutral / trade-off:**

- Fonts ships a pattern (how to add a custom font), not a fixed choice. Acceptable: typography is the single most brand-bearing UI decision, and fixing it template-wide would force unwanted homogeneity across apps.
