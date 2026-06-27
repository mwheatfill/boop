# DESIGN.md

The standing operational reference for building interfaces in boop. Cited by every UI PR. Read this alongside [`AGENTS.md`](AGENTS.md) and [`CONTEXT.md`](CONTEXT.md) at session start.

This file is rules. The session-level brief and "what's queued" log lives at [`docs/design-direction.md`](docs/design-direction.md). The why behind each decision lives in `docs/adr/`. When a section here says "Queued," the target pattern is named but not yet implemented; check the brief for the latest queue state before starting work.

## 1. Principle

Lean toward a beautiful, aesthetic, simple UI that doesn't limit function or power.

The audience is developers and IT operators. They expect dense information when they want it, generous whitespace when they don't, and keyboard shortcuts for everything they do more than twice a day. Simple as a default; powerful when invoked.

## 2. Reference aesthetic

**Linear-leaning, not Linear-orthodox.** boop adopts Linear's structural patterns: monochrome chrome, flush tiled grids, sharp data edges, three-anchor theme system, dense rows, keyboard-first interaction, command palette, inline feedback over toasts, evolution over revolution. boop diverges where the warm orange brand identity carries meaning: the chart palette and dashboard accents.

The brand-vs-UI-accent split is load-bearing. The UI chrome is monochrome dark with a single cool-blue accent for action. The warm orange brand identity surfaces in `--chart-1..3`, dashboard tiles, illustrative accents, and marketing. Operators see one color carry one meaning; nothing competes with operational state.

## 3. Visual tokens

Canonical shadcn flat OKLCH tokens on `base-vega` (Base UI). Two blocks in `src/styles/app.css`: `:root` (light) and `.dark`. Every token has a value in each. Per [ADR-022](docs/adr/022-design-language-pass-2.md).

**Theme refresh workflow.** Open [`ui.shadcn.com/create`](https://ui.shadcn.com/create), tune a theme, copy the CSS block, paste into `src/styles/app.css` over the `:root` + `.dark` blocks. Re-add the three project token extensions (`--success` / `--warning` / `--info` and their foregrounds) if the paste removed them. The shape matches verbatim — no translation step.

**Mode structure is light-first; dark is the user default.** `:root` carries light values; `.dark` overrides. `next-themes` `defaultTheme="dark"` keeps the user-facing default unchanged. The CSS structure matches the shape `shadcn-create` emits so pastes are verbatim.

**Project token extensions** beyond shadcn's canonical set: `--success`, `--warning`, `--info` and their foreground variants. Defined in both blocks; mapped through `@theme inline` to Tailwind utilities (`bg-success`, `text-warning-foreground`, etc.).

**Semantic state values** (low chroma, hue-canonical):

| Token | Light (`:root`) | Dark (`.dark`) |
|---|---|---|
| `--success` | `oklch(0.55 0.12 150)` | `oklch(0.7 0.1 150)` |
| `--warning` | `oklch(0.65 0.13 85)` | `oklch(0.78 0.1 85)` |
| `--info` | `oklch(0.55 0.13 235)` | `oklch(0.7 0.1 235)` |
| `--destructive` | `oklch(0.55 0.18 25)` | `oklch(0.62 0.15 25)` |

**Borders are hairlines at low alpha.** Light: `oklch(0 0 0 / 0.10)`. Dark: `oklch(1 0 0 / 0.08)`. Structure emerges from border lines, not gaps or shadows.

**Radius is `0.5rem` (8px)** for default-radius surfaces. Smaller / larger derive from `--radius-sm` / `--radius-lg` / `--radius-xl`. Radius applies only to floating overlays and interactive controls (see § 5 Lists and tables for the no-rounded-data-surface rule).

**Chart palette carries the warm orange brand.** `--chart-1` through `--chart-3` are the warm orange family from the source brand palette; `--chart-4..5` are complementary cool and green for stacked / multi-series charts.

**Font stack is the system stack** (`ui-sans-serif, system-ui, sans-serif`). Inter Variable adoption is queued; the override path is documented in `src/styles/app.css`.

## 4. Navigation layout

**URLs nest under Workspace** per [ADR-027](docs/adr/027-domain-simplification-workspace-consolidation.md) (superseding ADR-018's Customer grammar). Navigation surfaces are Jobs-first; a Workspace switcher in the sidebar header scopes Workspace-owned surfaces.

```
/                                                           Home (Jobs-first table, cross-Workspace)
/jobs                                                       Jobs (cross-Workspace)
/runs                                                       Run history (cross-Workspace)
/templates                                                  Job templates
/targets?ws=$slug                                           Targets (active-Workspace-scoped)
/channels?ws=$slug                                          Channels (active-Workspace-scoped)
/alert-rules?ws=$slug                                       AlertRules (active-Workspace-scoped)
/workspaces                                                 Workspace list
/workspaces/$workspaceSlug                                  Workspace hub (overview + Jobs)
/workspaces/$workspaceSlug/jobs/$jobSlug                    Job detail
/workspaces/$workspaceSlug/channels/$channelSlug            Channel detail (nested for slug-uniqueness)
/w/$workspaceSlug/$jobSlug                                  Public webhook receiver
```

The active Workspace is a retained `ws` search param (defaults to the first Workspace); the switcher sets it, and the Targets / Channels / AlertRules surfaces read it. Flat list, nested detail.

**Current layout: inverted-L sidebar.** A fixed-left sidebar at ~16rem (~256px) collapses to a ~3rem icon rail. Sections from top: brand mark + Workspace switcher (current Workspace, click to switch; defaults to the active Workspace), primary nav (Home, Jobs, Templates, Workspaces, Runs, Targets, Channels, Alert Rules), `Recent` (shared store with the Cmd+K palette), `Pinned` (device-local, capped at 20), footer with theme toggle + user menu. Below the `md` breakpoint the sidebar becomes a slide-in drawer via the shadcn `sidebar` primitive's built-in `Sheet` integration. Content area scrolls independently. The brand-vs-UI-accent split holds: chrome stays monochrome with the cool-blue accent reserved for selection and primary action.

**Title strategy:**
- List views: small heading at top-left (`My Jobs`, `Workspaces`, `Runs`). The data is the focus, not the page name.
- Detail views: large heading carrying the entity title (the Run, the Job, the Workspace name).

**Breadcrumbs reflect URL nesting** on detail pages: `Workspaces > Acme > Jobs > db-backup > Run`. Workspace-nested URLs make this mechanical.

## 5. Lists and tables

**Dense rows.** Target row height ~36–40px for issue / Job / Run lists, ~32px for sidebar items. Slice 1+2 are at the dense end of this range; verify on dev when adding new lists.

**Flush tiled grids, sharp edges on data.** Content panels sit edge-to-edge, separated by 1px border lines (not whitespace or shadow). Tables and list containers have `border-radius: 0`. Rounded corners are reserved for floating / elevated surfaces only (modals, dropdowns, command palette, popovers, individual buttons / pills).

**Three border tiers** define hierarchy without gaps:
- **Strong:** section and component boundaries (sidebar edge, header, metric grid outer borders, filter bars).
- **Default:** internal component borders (`--border`, inputs, buttons, table headers).
- **Subtle:** lightest separators (table rows, activity items, detail panel internals). Often `oklch(1 0 0 / 0.04)` in dark mode.

**Filter chips sit at the top of the content area** as pill-shaped buttons. Active filter has a filled background (cool-blue tint at low chroma); inactive filters are outlined only. The "All" chip is always present and reads as the cleared state.

**Primary action top-right.** "Create new Job," "Add Customer," "Send test alert" land at the top-right corner of the content area, opposite the filters. Always the same hue: `--primary` (cool blue).

**Selected-row indicator** is a 1px left border in `--primary` at low chroma (`var(--theme-accent)` mixed toward the background), plus a subtle background tint. Not a full-color flood.

**Status indicators use shape AND color**, never color alone. Hollow circle = backlog / scheduled. Filled circle = in progress / running. Filled bar / pill = priority. Filled X = canceled. Filled checkmark = complete / success. Color reinforces the shape; color-blind operators read the shape.

## 6. Forms

**TanStack Form per [ADR-013](docs/adr/013-forms-and-validation.md).** Zod schemas validate on the client and round-trip to the server function.

**Slug auto-fill** convention per PRD #16: slug derives from the entity's name on create, immutable on edit. The `<SlugField>` shared component handles the auto-fill + immutability + uniqueness-error surfacing.

**Inline validation on blur and on submit.** No "validate as you type" spam (causes red-screen-while-typing). Server errors flow back to the form via TanStack Form's onSubmitAsync return shape.

**Current shape: separate `/new` and `/edit` routes** with labeled inputs, one field per row. Save semantics: explicit "Create" / "Save" button; no save-on-blur.

**Queued: Linear-style modal-with-inline-pills.** Target pattern from Linear screenshots: rounded modal with a huge placeholder-only title field, a large description field, a row of inline property pills (`Backlog | Priority | Assignee | Labels`) that open pickers on click, a bottom action bar (attach / Create more toggle on left, Cancel / primary CTA right). The inline-edit-vs-drawer-vs-page convention is the open decision; modal-with-pills is the Linear-leaning target. See `docs/design-direction.md`.

## 7. Shortcuts

**Queued.** Linear-leaning target:

- **Single-letter for common actions on the current page:** `r` Run now from a Job detail page, `p` pause / resume, `c` create new (context-aware), `e` edit, `Esc` close.
- **Chord sequences for navigation:** `g j` go to Jobs, `g c` go to Customers, `g h` go to home, `g r` go to /runs. Two-key vim-style.
- **`?` reveals a cheatsheet overlay** listing every active shortcut on the current page.
- **Cmd+K (Ctrl+K) opens the command palette** — the navigation accelerator across all surfaces. Fuzzy search for Customer / Job / Run by name or slug. Tab switches into "Ask Linear"-equivalent AI mode (future, see ADR-015). Each option in the palette shows its keyboard shortcut on the right; first option is pre-selected (Enter executes).
- **Shortcut hints surface on hover** after ~500ms — a banner showing the keyboard shortcut for the element under the cursor. Gentle training, not popup spam.

See `docs/design-direction.md` for queue state.

## 8. Motion

**Queued.** Target tokens (no consumers yet):

- `--motion-fast: 120ms` — hover, focus, button press.
- `--motion-medium: 220ms` — popovers, drawers, route transitions.
- `--motion-ease: cubic-bezier(0.4, 0, 0.2, 1)` — Material "standard" curve, Linear-equivalent.

**Motion communicates state changes, never decoration.** Small animations on starring, completing, dragging give tactile feedback (~200ms). No bouncy springs, no scroll-jacking, no entrance animations on every page load.

**Optimistic updates over spinners.** Per Linear's "100ms target" principle. Apply state changes to the UI immediately; if the server rejects, roll back with a quiet inline notification. No spinner during the request unless it exceeds ~400ms.

## 9. Empty, loading, and error states

**Empty has three patterns:**

| Variant | When | Shape |
|---|---|---|
| **With-CTA** | The user can act to fix the empty | Centered icon + title + description + primary CTA button. Example: "No Jobs yet. Create one to schedule HTTP calls." + `Create new Job` button. |
| **Icon-only** | Descriptive empty, no action needed | Centered icon + muted message. Example: "No unread notifications." |
| **Inline** | Contextual empty in a sub-panel | Muted text only, no icon. Example: a properties row that reads "No labels used." |

Pick the variant that matches whether action would help.

**Loading is mostly handled by the framework.** TanStack Router `pendingComponent` shows after `pendingMs: 1000` (default) and stays at least `pendingMinMs: 500` to avoid flash. Streaming data (polling Recent Runs, watching a Run in flight) uses TanStack Query's `refetchInterval` per the convention in PRD #16 slice 2 (5s while `running`, terminal on `completed`).

**Errors flow through TanStack Router `errorComponent`.** Recipes (Sentry, App Insights, OTel per AGENTS.md) overlay the structured-error logging without touching call sites. A user-facing error renders a centered message with a "Try again" CTA and the underlying error message in muted text below.

## 10. Accessibility

**Keyboard-first.** Every action reachable by mouse is reachable by keyboard. Tab order is logical and predictable. Focus is always visible: `--ring` is `var(--theme-accent)` at full chroma, 2px ring with offset.

**Status uses shape + color**, never color alone. (See § 5 Lists and tables.) Operators with color-blindness read the shape; color reinforces.

**ARIA labels on icon-only controls.** Every icon button gets `aria-label`. Every interactive surface that isn't a native button (`<a>`, `<button>`) gets the right role.

**Contrast.** At `--theme-contrast: 0.7` (default), foreground / background contrast is in WCAG AA range for body text. A future `--theme-contrast: 0.95` mode lands as an accessibility theme toggle without code changes to components (the derivation handles it).

## 11. Anti-patterns

The most common ways to break this design system. Each undermines the core aesthetic.

- **Container nesting.** No `.card > .card-body`, `.panel > .panel-content`, or similar wrapper-divs-for-grouping. Use background tone steps and border lines for hierarchy.
- **Decorative shadows on data.** `box-shadow` is reserved for floating / elevated surfaces (modals, dropdowns, popovers, the command palette). Tables, panels, list containers stay flat. Use a tone step or a 1px border for section distinction.
- **Rounded data surfaces.** `border-radius` on table containers, grid cells, list items, content sections is wrong. Round corners only on buttons, inputs, badges / pills, and floating overlays.
- **Max-width content containers.** `max-width: 800px; margin: 0 auto;` fights the grid. Content fills its column; the sidebar + content layout handles width.
- **Tables for non-tabular data.** Activity feeds, comments, narrative content — render as styled row lists with typography hierarchy. Reserve `<table>` for genuinely columnar data.
- **Color absence as "restraint."** "Color restraint" means small and intentional, not "zero color." Status colors, primary accent, brand orange in charts are all in scope. The right amount is "where it carries meaning, nowhere else."
- **Bland empty states.** "No items found" is not an empty state. Pick the right variant from § 9 (with-CTA / icon-only / inline).
- **Warm orange as UI chrome accent.** The brand palette lives in `--chart-1..3` and dashboard accents. Primary CTAs, focus rings, selected rows use `--primary` (currently cool blue). See [ADR-022](docs/adr/022-design-language-pass-2.md) brand-vs-UI-accent decision.
- **`--accent` as a duplicate of `--secondary`.** `--accent` is the faint tint for hovered items in dropdowns and contextual emphasis. `--secondary` is the larger muted surface. Treating them as identical loses the dropdown-item hover affordance.
- **Workaround flags in CSS / config.** Same rule as the research-first protocol re-anchored each turn: no workaround when a canonical alternative exists. If a token you need does not exist, add it as a project extension (mapped in both `:root` and `.dark`, exposed via `@theme inline`) — do not hand-roll an arbitrary color at the call site.
- **Re-introducing a derivation layer.** Anchor-derived tokens (e.g. `oklch(from var(--theme-base) calc(l + step) c h)`) were tried and removed in ADR-022. Theme refreshes go through the `ui.shadcn.com/create` paste workflow; values are pre-computed.

## 12. Further reading

ADRs that govern interface decisions:

- [ADR-008](docs/adr/008-ui-visual-layer.md) — UI / visual layer (shadcn-base-vega centered, Base UI primitives, Tailwind v4 conventions).
- [ADR-013](docs/adr/013-forms-and-validation.md) — Forms + validation (TanStack Form, React 19 actions, Zod).
- [ADR-018](docs/adr/018-navigation-ia.md) — Navigation IA (Customer-nested URLs, Jobs-first surfaces).
- [ADR-019](docs/adr/019-soft-delete-policy.md) — Soft-delete policy (archive UX, "Show archived" toggle).
- [ADR-022](docs/adr/022-design-language-pass-2.md) — Design language pass 2 (dark-first, three-anchor theme, cool-blue UI accent).

Project-internal:

- [`docs/design-direction.md`](docs/design-direction.md) — session brief, queue of remaining surfaces, "Landed" log.
- [`AGENTS.md`](AGENTS.md) "Things to avoid" — process-level rules (no em dashes, no journaling, no "what" comments).

Linear references that shaped this system:

- [Linear: How we redesigned the UI Part II](https://linear.app/now/how-we-redesigned-the-linear-ui)
- [A Design Reset](https://linear.app/blog/a-design-reset)
- [Linear's Delightful Design Patterns (Gunpowder Labs)](https://gunpowderlabs.com/2024/12/22/linear-delightful-patterns)
- [The Elegant Design of Linear.app (Telablog)](https://telablog.com/the-elegant-design-of-linear-app/)
- [Linear design: The SaaS design trend (LogRocket)](https://blog.logrocket.com/ux-design/linear-design/)
- [Linear — Radix Primitives Case Study](https://www.radix-ui.com/primitives/case-studies/linear)
