# ADR-023: Modal-with-pills as the create + edit convention

![Status](https://img.shields.io/badge/status-Proposed-yellow) ![Date](https://img.shields.io/badge/date-2026--05--12-blue)

## Context

DESIGN.md § 6 names "modal-with-inline-pills" as the queued target for create and edit, with the inline-vs-drawer-vs-page convention left open. Slice 1 + slice 2 shipped create at `/<entity>/new` and edit at `/<entity>/$slug/edit` as separate full-page routes built from the same `JobForm` / `CustomerForm` / `TargetForm` components. The shape reads like a config file: labelled inputs in a vertical stack, naming as the fifth-most-important act, the cron preview tucked at the bottom of the trigger block. The Linear-leaning brief at `docs/design-direction.md` calls for a focused, dense, keyboard-first authoring surface that puts naming first and the trigger preview front-and-center.

The decision touches every CRUD entity in the product (Job, Customer, Target today; Channel and AlertRule landing in PRD #25). Settling it once keeps the create + edit shape uniform; leaving it open splits the convention across entities as each PR makes its own call.

## Decision

Modal-with-pills, routable via TanStack Router route masking, used for both create and edit on every entity. One shared `<EntityModal>` primitive backs all entities.

| Concern | Choice | Over |
|---|---|---|
| Create surface | Modal-with-pills | Separate `/new` page (current); right-side drawer; full-screen overlay |
| Edit surface | Same modal-with-pills, pre-filled, slug read-only, title and primary action verb change | Separate `/edit` page (current); inline-edit-on-blur |
| Routability | TanStack Router `createRouteMask` with `unmaskOnReload: true` | Imperative open/close state; parent route + Outlet without masking; modal-as-search-param |
| Modal primitive | Base UI `Dialog` wrapped in a shadcn `base-vega`-style `src/components/ui/dialog.tsx` | `@radix-ui/react-dialog`; hand-rolled overlay |
| Stacking | One level deep via Base UI's native nested-dialog support (child renders without backdrop; parent stays visible) | No stacking; modal-replaces-modal; sub-route fallback |
| Dirty-form discard | `useBlocker({ shouldBlockFn, withResolver: true })` plus an inline confirm row rendered inside the modal | Browser-native `confirm()`; custom global state; toast |
| Convention scope | All CRUD entities (Job, Customer, Target now; Channel + AlertRule from PRD #25 inheriting at landing) | Mixed conventions per entity |

**Composition.** The modal renders a placeholder-only name input as the primary field, followed by a row of property pills that open pickers (Base UI `Popover` for short pickers; inline-expand for the trigger picker and template editor). Pill states: default (dotted outline, "Required" hint when validation kicked in), filled (`bg-primary/10 text-primary border-primary/30`), invalid (`bg-destructive/10 text-destructive border-destructive/30`). The bottom action bar carries an optional "Create another" toggle (Job only), a Cancel, and a primary CTA. Cmd+Enter submits; Esc closes (routing through the blocker when dirty).

**Routing.** Each modal is a real route in the route tree. Navigation through entry points (dashboard, `/jobs`, Customer hub) uses `<Link>` with `mask={{ to, params }}` to display the parent URL. `createRouteMask` declarations register on `routeMasks: []` in `getRouter()`. Direct-share of the modal URL opens the modal on a plain backdrop (no parent visible behind), per the masking trade-off documented in the TanStack docs and accepted by the PRD.

**Nested dialogs.** Per [Base UI's Dialog docs](https://base-ui.com/react/components/dialog), `Dialog.Root` instances nest without extra wiring. Child dialogs render without their own backdrop; `data-nested-dialog-open` is set on the parent, and a `--nested-dialogs` CSS variable tracks depth. Used for "+ New Target" inside the Job-create flow: a second `<EntityModal entity="target">` opens over the Job modal; submitting selects the new Target back in the parent and closes the child; canceling preserves the parent draft. Limited to one level.

**Form layer reuse.** TanStack Form remains the form layer (ADR-013). `JobForm`'s field schemas, slug auto-fill, and `payloadFor` shape lift into the modal components; the per-section layout is replaced by the pill composition. `CronPreview`, `IntervalChips`, `TemplateEditor`, `SlugField`, and `WebhookSecretPanel` (PR #41) all render inside the new modal without modification.

## Consequences

**Positive:**

- One create + edit shape across Job, Customer, Target. PRD #25 (alerting v1) inherits the convention from day one; the chrome stays uniform as new entities land.
- Naming the entity is the first and most prominent act of authoring; the cron preview becomes the dominant feedback affordance during trigger authoring instead of a footer.
- `useBlocker` + the inline discard row keep the dirty-form prompt native to boop and accessible, where `confirm()` is neither.
- Authoring a Target without leaving Job-create is the canonical path, not a workaround: Base UI's native nested-dialog support means no second backdrop, no custom stacking logic.
- Refresh closes the modal automatically (`unmaskOnReload: true`); direct-share opens the modal directly without a half-rendered parent.

**Negative:**

- Mask state lives in `location.state` and is lost on share / new-tab / refresh. Sharing a modal URL navigates straight to it without the masked parent in the URL bar. This matches Linear's behavior and is accepted.
- The pill composition is denser than the slice-1 form layout; users coming from `/new` pages need a second to find where labels went. The placeholder-only style is deliberate; the audience tolerates density per DESIGN.md § 11.
- Edit-as-modal precludes a "shareable edit URL with the page chrome visible" pattern. Sharing `/<entity>/$slug/edit` lands the recipient on the edit modal; closing returns them to the entity detail. Acceptable.

**Neutral / trade-off:**

- Picks `createRouteMask` over parent-route + Outlet. The Outlet pattern would keep the parent route mounted (and therefore visible) behind the modal, but mixes routing semantics with overlay semantics and complicates breadcrumbs, page titles, and loader scope. Masking keeps routes one thing each.
- One `<EntityModal>` primitive over per-entity modal components. Centralizes accessibility, motion, dirty-discard, "Create another", and stacking; an entity needing a different chrome contradicts the convention and should land a follow-up ADR rather than a per-call override.
- Width caps at `clamp(320px, 90vw, 600px)`. Wider modals encourage the labelled-config-file shape this ADR replaces; a future PRD that needs more breathing room (e.g. a CodeMirror upgrade for body templates) can introduce a `size="wide"` variant.
- "Create another" is a Job-only affordance for now. Customer and Target authoring is rare enough that batching doesn't justify the toggle.
