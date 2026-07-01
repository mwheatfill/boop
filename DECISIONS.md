# Decisions

A running log of design and product decisions that are too small or too fast-moving for an ADR. Newest first. One entry = what we decided + the why in a few lines. **Supersede by adding a new entry that names what it replaces; don't rewrite old entries.** Reserve `docs/adr/` for the big architectural locks (runtime, framework, data layer, auth); everything else lands here so we capture intent without ADR sprawl.

---

## 2026-06-30: Defer the authed server-fn builder (TanStack Start can't extract a factory-object builder)

**What:** The architecture review's "fold `createDb(env.DB)` + auth into an `authedFn`/`adminFn` builder" deepening is **deferred**, not adopted. A builder that makes input validation *mandatory by construction* (a factory taking the Zod schema as a required argument) is not viable: TanStack Start's compiler extracts a server function only when the `.handler()` chain's base resolves to the `createServerFn` import ("Root") or a const bound to a `createServerFn()…` chain ("Builder"). A factory-object (`authedFn.mutation(schema).handler(fn)`) resolves to "None", so the handler is **never stubbed on the client** and its body ships to the browser bundle (verified: server-only strings such as the KEK-config error appeared in `dist/client/*` chunks). `pnpm build` / `test` / `audit:patterns` all still pass, so the gates do not catch it.

**Why:** "Validation mandatory by construction" needs a factory-with-schema-param, which is exactly the shape the extractor cannot follow, the two requirements are mutually exclusive under this compiler. The preamble duplication is a mild smell (the four-file feature seam, `createDb`, and `getCurrentUser` are already deep), not worth a third broad rewrite of every `server-fns.ts` plus the client-bundle-leak risk for the lowest-priority finding.

**If revisited:** the extraction-safe shape is a **const-builder** (`export const authedMutate = createServerFn({ method: 'POST' }).middleware([authMiddleware, dbContext])`, used as `authedMutate.inputValidator(Schema).handler(({ context: { db }, data }) => …)`). It folds the `createDb` + middleware preamble but **cannot** make validation mandatory-by-construction, validation stays **audit-enforced** by extending `scripts/audit-patterns/tanstack.ts` to require `.inputValidator` on mutating const-builder chains. That is a materially different design (audit-enforced vs by-construction) and should be an explicit choice before adopting.

---

## 2026-06-30: Deleting a tunnel is permanent (supersedes the "tunnels in the Recycle Bin / teardown on purge" part of the entry below)

**What:** Deleting a tunnel tears down its Cloudflare resources (tunnel, DNS, Access app + policy, cert, Service Token) immediately and removes the Targets that ride it and their Jobs. It is permanent and does **not** go to the Recycle Bin. Everything else still soft-deletes to the bin; only tunnels are permanent, because they own live cloud infrastructure and are the root dependency of their Targets and Jobs.

**Why:** A "deleted" tunnel that kept serving traffic with live credentials until a separate purge was a security and UX trap. Delete should mean the path is actually gone. Instant restore isn't worth leaving a private route open.

**UX:** the confirm says, in plain language, that it permanently removes the Cloudflare tunnel plus its Targets and Jobs and can't be undone, and it requires typing the tunnel name to proceed (ui-craft § 1: type the resource name for high-stakes actions). To keep the Targets instead, **Move Targets** reassigns them to another tunnel (re-deriving each Target's URL + re-syncing both tunnels' ingress) so the source tunnel can then be deleted empty.

---

## 2026-06-30: Delete + Recycle Bin (replaces the "Archive" concept; relaxes ADR-019; defers ADR-028 teardown to purge)

**What:** The primary destructive verb is **Delete**, and it's soft by default: the item moves to a **Recycle Bin** and is recoverable. There is no separate user-facing "Archive / keep around" idea; the existing `status='archived'` value stays as the internal soft-deleted state, surfaced as **"Deleted."** (Renaming the enum is a 7-table D1 CHECK migration, not worth it.)

- **Recycle Bin** (`/recycle-bin`): one cross-entity list of deleted items with **Restore** and **Delete permanently** (purge = hard delete). Replaces the per-list "Show archived" toggles.
- **Dependents:** Delete never makes you pre-clear them (reverses ADR-019's *block on active dependents*). It cascades, with a clear prompt ("Deleting this Tunnel deletes its 3 Targets and stops 2 Jobs."), in one transaction. Restore is symmetric: restoring a parent brings back the children deleted with it.
- **Tunnels:** Delete is soft only (the connector keeps running, hidden, its Jobs stopped). The Cloudflare teardown (DNS, Access, cert, tunnel) happens on **purge** (supersedes ADR-028's teardown-on-decommission). Restore is instant; a deleted-not-purged tunnel still holds its wildcard cert until purged, which is fine at our ~20-tunnel scale.
- **Language:** inline and plain. "Delete" with a one-line "moves to the Recycle Bin, restore anytime"; in the bin, "Restore" and "Delete permanently, can't be undone."

**Why:** "Archive" implies *keep this around to look at later*; most of the time the operator is cleaning up things they no longer use, which is *Delete*. The Recycle Bin makes Delete safe (recoverable) without the friction of pre-archiving dependents or the meaningless block.

**Build order:** (1) Recycle Bin route + purge (additive, safe). (2) Archive to Delete rename + cascade-on-delete (together, so "Delete" never blocks). (3) Tunnel teardown-on-purge + drop the per-list toggles.
