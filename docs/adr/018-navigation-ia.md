# ADR-018: Navigation IA (Customer-nested URLs, Jobs-first navigation surfaces)

![Status](https://img.shields.io/badge/status-Proposed-yellow) ![Date](https://img.shields.io/badge/date-2026--05--12-blue)

## Context

boop's primary entities — Customer, Target, Job, Run — sit in a strict ownership tree: a Job belongs to one Customer, a Target belongs to one Customer, a Run belongs to one Job. The schema enforces this with FKs and with **per-Customer slug uniqueness** (`jobs_customer_slug_idx` and the new `targets_customer_slug_idx` from this PRD's slice 1 are unique on `(customer_id, slug)`, not globally on `slug`). The existing public webhook receiver `/w/$customer/$slug` already uses Customer-nested URLs.

Two competing pulls show up in the IA:

- **Data ownership wants nested URLs.** With per-Customer slug uniqueness, a flat `/jobs/$slug` URL is ambiguous; you'd have to key by ULID. Nested URLs are also what `/w/$customer/$slug` already established.
- **Operator workflow is Jobs-first.** A SwitchThink operator's daily session is "what's failing, what's about to fire, what do I need to fix" — across all ~270 Customers, not inside one. Landing on a per-Customer hub by default is workflow drag.

Picking only one of these is the wrong answer. Picking only nested URLs implies a Customer-rooted navigation that doesn't match daily use. Picking only Jobs-first navigation means flat URLs that need ULIDs and break the consistency with `/w/$customer/$slug`.

## Decision

URL grammar nests under Customer; navigation surfaces are Jobs-first.

| Concern | Choice | Over |
|---|---|---|
| Resource URLs | **Customer-nested with slugs.** `/customers/$customerSlug`, `/customers/$customerSlug/targets/$targetSlug`, `/customers/$customerSlug/jobs/$jobSlug`. | Flat URLs keyed by ULID (lose human-readability, lose consistency with `/w/$customer/$slug`, fight the per-Customer slug-uniqueness model). |
| Home page (`/`) | **Flat Jobs table across all Customers** with `Customer` as a column and filter chip. The operator's daily landing surface. | Customer-rooted dashboard (forces a navigation hop before the operator can see what's wrong); empty marketing surface (wastes the most-visited route). |
| Customer hub (`/customers/$customerSlug`) | **Drill-in for one Customer.** Targets section + Jobs section. Used for Customer-scoped tasks (rename, archive, add Target) — not the daily landing. | Treating the Customer hub as the primary surface (it isn't — it's the org chart, not the day-to-day). |
| Future cross-cutting Runs view | **`/runs` cross-Customer with filters.** Future PRD. | Forcing the operator to visit each Customer's Job detail page to triage failures. |
| Future cmd+K palette | **Indexes Jobs and Runs by name across all Customers.** Customer is a filter, not a navigation gate. | Customer-scoped palette (operator has to enter the right Customer first to find anything). |
| Status badges, breadcrumbs | **Breadcrumbs render the URL nesting** (`Customers › Acme › Jobs › DB Backup`). Status badges everywhere prefer outcome / status, not Customer name. | Hiding the Customer (loses scoping context); leading with Customer (re-introduces Customer-first feel). |

The two principles in one sentence: **URLs reflect data ownership; navigation reflects task flow.**

## Consequences

**Positive:**

- The operator's daily landing surface (`/`) is one click from "what's wrong" — no Customer pre-selection.
- Per-Customer slug uniqueness produces human-readable URLs (`/customers/acme/jobs/db-backup`) without needing ULIDs in the address bar.
- The `/w/$customer/$slug` webhook receiver shape matches the operator-facing URL shape — one mental model for "this URL identifies a Job for Acme."
- Customer hub stays meaningful: it's the org chart for that Customer (Targets + Jobs + future Channels + future AlertRules), used by Admins for setup and Operators for "show me everything Acme has."
- Future cross-cutting surfaces (`/runs`, cmd+K) inherit the same Jobs-first principle without retro-fitting.
- Operators with deep MSP context can still navigate the URL grammar directly (paste a URL into chat, jump from a runbook); URL grammar is consistent and predictable.

**Negative:**

- Two mental models exist in parallel. New engineers see nested URLs and may assume Customer-rooted UI. The home page and `/runs` surfaces break that assumption.
- The home page becomes a non-trivial product surface (filter chips, status filters, Customer column) instead of a marketing-style splash. More UI work in slice 2 (per Q14-A).
- The Customer hub is less visited by Operators than a Customer-first IA would imply, so it's tempting to under-invest in it. The hub still needs to be polished because Admins live there.

**Neutral / trade-off:**

- The decision pushes a flat dashboard view into slice 2 (per the PRD that landed alongside this ADR). The dashboard could be deferred to a separate slice; we chose to ship it with Jobs CRUD because the data model is already in place and the Operator's first-day experience benefits from it.
- This ADR doesn't decide what the home page looks like beyond "flat Jobs table". Stat tiles, "needs attention" rollups, charts — those belong to a follow-on design-language session. The decision here is the directional one (Jobs-first); the dashboard's visual maturity grows after.
- A future need for per-Customer Operator scoping (ADR-016 phase 2) interacts with the Jobs-first home: the same query needs to filter by which Customers an Operator can see. The home-page query and the cmd+K index both inherit that filter cleanly because they're already filterable by Customer.
- We are not committing to a cmd+K palette or `/runs` here, only to the principle that they'd be Jobs-first when they ship.
