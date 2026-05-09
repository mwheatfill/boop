# Spec fidelity

A common failure mode: agents start with a clear spec, drift from it during implementation, and silently end up with something that doesn't match what was asked for. This rule prevents that.

## Locate the spec at session start

Look in this order for a canonical spec document:

1. `SPEC.md` at repo root
2. `PRD.md` at repo root
3. Files matching `/spec|brief|prd/i` in `docs/`
4. The most recent file in `docs/` if it looks like a planning document
5. The repo's GitHub issue marked "spec" or pinned

If multiple candidates exist, **ask the user which is canonical** before assuming. Don't pick silently.

If no spec exists, **say so explicitly**. Don't fabricate intent. Many sessions are appropriate without a spec (small fixes, tooling changes), but pretending a spec exists when it doesn't is worse than admitting absence.

## Read it before code

For any non-trivial implementation work:

1. Read the canonical spec section that covers the concern.
2. Cite the spec in your plan or first response. ("The spec at `docs/spec/scheduler.md` says X, so I'll do Y.")
3. If the spec is unclear, ask. Don't guess.

## Re-anchor before architectural moves

A long session drifts. Mid-session, before:

- Introducing a new pattern, library, route shape, or data model
- Renaming or restructuring directories
- Changing how layers communicate (auth, DB, AI, email)
- Removing or modifying a public API surface

… **re-read the relevant spec section.** Five minutes of re-reading prevents an hour of unwinding.

## Surface deviations explicitly

If your proposed move conflicts with the spec or extends it:

1. State the conflict or extension plainly. ("The spec says X, but I'm proposing Y because Z.")
2. Propose a spec edit if the spec is wrong or stale. Don't drift around it.
3. Wait for the user to either accept the deviation, edit the spec, or redirect.

## Spec edits are first-class

Treat the spec like code:

- Edit it when you discover the implementation reality differs from what was written.
- Commit the edit as part of the implementation work, not separately ("…and updated SPEC.md to reflect the new shape").
- If you're wrong about needing the edit (the user says "no, the spec is right, you should follow it"), revert the edit.

A stale spec is worse than no spec; it sends future agents off course.

## ADRs and the spec

Architecture Decision Records (`docs/adr/`) supplement the spec. They capture the "why" behind locked architectural choices. If you're contemplating overriding an ADR-locked decision:

1. Read the ADR. Understand the reasoning.
2. If you still think the override is right, propose it with a counter-rationale.
3. The user either rejects, accepts (in which case the ADR gets a `Superseded by ADR-NNNN` status update and a new ADR captures the new decision), or you compromise.

ADRs are part of spec fidelity. Don't override them silently.

## Don't

- Don't start coding without locating the spec, even briefly.
- Don't paper over a conflict between your work and the spec by burying the conflict in the diff.
- Don't fabricate spec contents from training data. If you don't have it in front of you, ask.
- Don't assume "the user said X in chat" overrides the spec. Sometimes it does (the user's word is final), but make that explicit and update the spec.
