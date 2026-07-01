# ADR-019: Soft-delete policy (archive blocks on active dependents)

![Status](https://img.shields.io/badge/status-Accepted-brightgreen) ![Date](https://img.shields.io/badge/date-2026--05--12-blue)

## Context

Customer, Target, and Job all carry a `status` column whose `archived` value is the soft-delete state. Customers and Targets have `status: active | archived`; Jobs have `status: active | paused | archived`. The schema's foreign keys are `onDelete: 'restrict'` (per PR #2), so hard deletes can't orphan rows — but the soft-delete behavior is unspecified at the application layer.

The risk is "what happens when an operator archives a Customer that still has active Jobs". Three behaviors are on the table:

- **Cascade-archive.** Archiving a Customer flips every dependent Job and Target to `archived` in the same transaction. One click, large blast radius.
- **Allow with orphans.** Archived Customer can still own active Jobs. Heartbeat behavior must then check both Customer status and Job status; observability becomes "this Job fired against an archived Customer."
- **Block on active dependents.** Refuse the archive; surface the count and let the operator fix it first.

Picking poorly: cascade silently kills dozens of Jobs that were still firing; orphans-allowed creates a state where Runs and Customer status are inconsistent.

## Decision

Archive blocks when active dependents exist. Restore (unarchive) is the inverse, and for interval-typed Jobs it re-arms the DO alarm.

| Concern | Choice | Over |
|---|---|---|
| Archive a Customer | **Block** when any of its Jobs has `status != 'archived'`. Surface message: "Acme has N active Jobs. Archive them first." Operator either archives each Job individually or pauses-then-archives in bulk (bulk action is out of this PRD; surfaced as an item for a later UX pass). | Cascade-archive (one-click destruction of dozens of Jobs); orphans-allowed (Customer status becomes meaningless for filtering). |
| Archive a Target | **Block** when any Job that references it has `status != 'archived'`. Same message shape. | Cascade-archive (the dependent Jobs reference the Target's URL / auth config; flipping them to `archived` is a side-effect the operator didn't ask for). |
| Archive a Job | **Always allowed.** The heartbeat (per [ADR-014](014-two-lane-dispatch.md)) already filters `status = 'active'`; the alarm-lane DO checks status in its `alarm()` handler (per dispatch slice 5). Archiving a Job is a single-row decision with no dependents to worry about. | Adding a confirmation gate (operators archive Jobs routinely; the confirmation modal is friction, not safety — the alert-dialog from Q8b is sufficient). |
| Restore (unarchive) a Customer / Target | **Set `status = 'active'`.** No cascade-restore of dependents (they were archived independently and stay archived until restored individually). | Cascade-restore (couples decisions that the operator made separately). |
| Restore (unarchive) a Job | **Set `status = 'active'` and, for `trigger_kind = 'interval'` only, call `enterIntervalMode` to re-seed the per-Job DO alarm.** Cron and webhook Jobs need no extra step; the heartbeat picks them up on its next tick. | Always re-seeding (wastes a DO call for non-interval Jobs); never re-seeding (interval Jobs come back as "active but never fires" because the alarm was cleared on the way down). |
| Pause vs archive on Jobs | **Pause is reversible; archive is the soft-delete endpoint.** Pause and archive are surfaced as separate items in the actions menu. Resume restores `active` from `paused` (no DO re-seed needed — the alarm was never cleared, just the heartbeat / alarm handler started skipping it). | Treating pause as a step toward archive (they're different intents — pause says "stop firing for now", archive says "this is done"). |
| Visibility of archived rows | **Hidden from default list views.** A "Show archived" toggle exposes them. Archived rows render in a muted style; the only available action on an archived row is "Restore". | Always-visible (visual clutter for the 99% case); permanent-hidden (loses the audit trail). |
| Hard delete | **Out of scope for v1.** No DELETE FROM. Hot-window archival (per CONTEXT.md "Hot window") moves Run / Attempt rows to R2, not the Customer / Target / Job rows. | Hard delete (loses the audit trail; breaks observability for in-flight Runs that reference the entity). |

## Consequences

**Positive:**

- The operator's intent is explicit at every archive step. No surprise mass-archives.
- The state space stays small: `(Customer.status, Job.status, Target.status)` combinations that are reachable are also semantically coherent. Filters like "show me all active Jobs across active Customers" return the answer the operator expects.
- The heartbeat and alarm-lane DO can keep their existing `status = 'active'` checks without needing to also walk up to the Customer / Target row. Dispatch hot path stays simple.
- Restoring is symmetric and predictable: undoing an archive returns the row to `active`; interval Jobs come back with their alarm re-seeded so "Restore" actually means "starts firing again."

**Negative:**

- Operators trying to wind down a Customer have a small UX cliff: they have to archive Jobs first, then Targets, then the Customer. A future "Wind down Customer" guided flow (or bulk-archive action) would smooth that, but isn't in v1.
- The block-then-explain pattern requires the UI to pre-flight the dependency count before showing the archive button's confirmation modal. That's one extra read per archive attempt — negligible cost.
- "Restore" doesn't restore dependents. An operator who archived a Customer plus all its Jobs has to walk back through the same list to restore each. Same cliff in reverse.

**Neutral / trade-off:**

- The schema's `onDelete: 'restrict'` FK behavior is a defense-in-depth backstop, not the policy. If the soft-delete check is ever bypassed (raw SQL, a future bulk migration), the FK still refuses to leave dangling references.
- The "Show archived" toggle in list views is a UX affordance, not a permission. Operators (and Admins) can see archived rows when they ask; they can't act on them beyond Restore.
- This ADR doesn't decide what happens to Runs and Attempts of an archived Job. They remain queryable (per CONTEXT.md "Hot window") and archive after the Hot window. The Run / Attempt rows don't carry a status column tied to their parent Job; the Job's status is the source of truth for "is this still relevant."
- Bulk archive (and the inverse, bulk restore) are deferred. The single-row UX in this PRD will eventually feel slow at scale; that's the trigger to revisit, not the launch bar.
