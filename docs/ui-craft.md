# UI craft

How to build UI here: **which container** to use, then **how to make the inside good**. Read this before building any screen, overlay, or editor. Adopted wholesale from the rollout app (`mcc`) per [ADR-029](adr/029-adopt-rollout-ui-system.md); the design *language* (tokens, nav, lists) stays in [`DESIGN.md`](../DESIGN.md), this is the *build craft*.

The reference for "good" lives in the rollout app: `member-detail-sheet.tsx` (a read view) and `ring-editor.tsx` (an edit view). boop's entity sheets (Phase 2) copy their structure; once one lands it becomes the local exemplar.

Grounded in [Geist](https://vercel.com/geist/modal), [NN/g](https://www.nngroup.com/articles/modal-nonmodal-dialog/), and the shadcn `base-vega` registry.

---

## 1. Choose the container

The deciding axis is **modality**: does it block the page (dim + trap focus + force a decision) or not? A modal is heavyweight, appropriate *only when the user must deal with it before continuing*.

| Use | When | Never for |
|---|---|---|
| **Page / route** | A standalone entity you navigate *to*; substantial, deep-linkable work | Quick confirms, contextual tweaks |
| **Dialog** (modal) | A decision that must block: required input mid-flow, one critical step. Keep it short | Non-essential info; long forms |
| **AlertDialog** | Destructive / irreversible confirms (delete, archive, revoke) | Anything non-destructive |
| **Sheet** (side, desktop) | Edit or inspect an entity **in its list/parent context**; multi-section content; the page stays useful behind it | Delete/archive (too soft; escalate the confirm to an AlertDialog) |
| **Drawer** (bottom, mobile) | The mobile form of a Sheet/Dialog | Desktop; destructive; long content |
| **Popover** | Lightweight, contextual, **anchored to a trigger**: filters, pickers, compact settings | A choice the user must not skip |
| **DropdownMenu** | A menu of actions from a trigger (the row `…` overflow) | Forms or rich content |
| **Tooltip** | A brief, non-interactive hint | Anything clickable inside |
| **Inline** | Validation errors, next to the field | — |

**Tiebreakers** (when two rows fire at once):

1. **Page vs Sheet**: standalone entity you navigate *to* → page; entity edited *in its list/parent context* → Sheet. An entity's read-only **detail** is a page (already routed); its **create/edit** is a Sheet.
2. **Consistency beats content-fit**: the same task uses the same container across create / edit / variants, even when one variant is lighter. **boop decision: all six entity editors (Job, Target, Channel, AlertRule, Tunnel, Workspace) are Sheets**, even the three-field ones.
3. **Promotion threshold**: a Sheet that needs more than ~3 sections, tabs, or a large canvas → promote it to a page. Job is the watch item here: it ships as a **wide Sheet** (`sm:max-w-2xl`); promote it to a page only if it reads cramped at real width.

**Responsive:** Sheet/Dialog on desktop ↔ Drawer (bottom sheet) on mobile, same content.

**No route-masking.** Overlays are plain open/close component state, opened from a row click or the top-right "New" action — not `createRouteMask` (the rollout app does not mask; ADR-023's masking is retired with ADR-029). Entity **detail** routes stay real routes.

**Destructive rules** (Geist): default focus to `Cancel`; the primary button is `Verb + Noun` ("Delete channel"), never "OK" / "Confirm" / a bare verb; gate dismissal when input is dirty; type the resource name for high-stakes actions.

---

## 2. Craft the surface: the checklist

Every surface passes this before it is "done."

**Shell**
- Overlays use the shell: a fixed **header**, a **scrollable body**, and a **pinned footer**. The primary action is always visible, never below the fold.
- An entity surface gets a **header anchor**: an icon or avatar + the name + a status/type badge. Not a bare title.

**Sections & rhythm**
- Group fields into **labeled sections** with an icon-anchored header (`Section`). Sections are visually separated (a `Separator` or `Card`), not floating labels on a flat wall.
- Spacing scale: `gap-6` between sections, `gap-3`/`gap-4` within a section, `gap-1.5`/`gap-2` between tight items. **No dead space**: nothing floats orphaned from its label, and there is never a screen of empty vertical void.

**Hierarchy**
- One clear title. Section headers are `uppercase text-xs text-muted-foreground` *with an icon*. Labels are muted; values are foreground. Do not give everything the same weight.

**Lists are lists**
- A list of entities (targets, variables, recipients) is **rows** (icon + name + secondary + a remove/action), not a raw `<textarea>` dump. Bulk paste is a *secondary* affordance, not the primary surface.

**Rows & click targets**
- A **simple row** (plain cells, no controls inside it) may be fully clickable for its primary action, a row `onClick`.
- A row **with its own controls** (drag handle, a sub-link, action buttons) is *not* one big click target: nesting interactive elements is invalid HTML and ambiguous. Make the **main content region a real `<button>`** for the primary action and keep the handle / sub-links / actions as **sibling controls** beside it. Tint the **whole row** on hover (`hover:bg-*` on the row, not an inset highlight on the button); the button carries `cursor-pointer` + an `aria-label` and uses span-based content so it stays valid inside the button. (Matches [`feedback-simplify-ui-row-click-consolidate`].)

**States: all three, always**
- **Loading** → skeletons matching the real layout. **Empty** → `Empty` (icon + title + optional action). **Error** → inline, near the cause, not a modal.

**Values & labels**
- **Humanize** stored values: never a raw lowercase enum in the UI ("Static", not "static"). Plain language, no jargon (DESIGN.md voice).
- Buttons are `Verb + Noun`. Primary action on the right.

**Density**
- A sparse surface gets tightened so it reads as one composed thing, not scattered fields.

---

## 3. The recipe

**Build from the blessed parts; do not freehand layout.** `base-vega` ships designed primitives, use them: `Card`, `Badge`, `Separator`, `ScrollArea`, `Empty`, `Field`/`FieldGroup`, `Select`, `Combobox`, `InputGroup`, `Skeleton`. Start from a shadcn **Block** or an existing good surface; never invent layout on a blank canvas.

**The Sheet/editor shell:**

```tsx
<SheetContent className="flex flex-col gap-0 p-0 sm:max-w-lg">   {/* Job: sm:max-w-2xl */}
  <SheetHeader className="border-b">     {/* anchor: icon + title + status/type badge */}
  <div className="flex-1 overflow-y-auto">  {/* body: <Section> stack, gap-6, p-4/5 */}
  <SheetFooter className="border-t">     {/* pinned: Cancel + Verb+Noun primary; Delete → AlertDialog */}
</SheetContent>
```

**`Section`** (`src/components/Section.tsx`, added in Phase 2): icon + `uppercase text-xs` title + optional hint + content, separated from its neighbors. Shared; every editor uses it.

---

## 4. Verify it: the visual loop

**You cannot craft what you cannot see.** Before "done":

- Render it and **look** at a screenshot, at real width. Check § 2 against the *picture*, not the DOM.
- Overlays animate, and the automation tab can freeze the entry animation (content stuck near `opacity: 0`). To see the static layout, after opening the overlay override the frozen styles (set the content and overlay to `opacity: 1; transform: none`), then screenshot. Or ask for a foreground screenshot.
