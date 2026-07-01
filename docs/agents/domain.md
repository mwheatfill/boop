# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Layout

**Single-context.** One `CONTEXT.md` and one `docs/adr/` tree at the repo root.

```
/
├── CONTEXT.md
├── docs/adr/
│   ├── 001-cloudflare-workers-runtime.md
│   ├── 002-tanstack-start-framework.md
│   └── ...
└── src/
```

## Before exploring, read these

- **`CONTEXT.md`** at the repo root for domain language (Job, Run, Attempt, Trigger, Workspace, Operator, etc.).
- **`docs/adr/`** for past architectural decisions in the area you're about to touch. Start with `docs/adr/README.md` for the index.

If any of these files don't exist, **proceed silently**. Don't flag their absence; the producer skill (`/grill-with-docs`) creates them lazily when terms or decisions actually get resolved.

## Use the glossary's vocabulary

When your output names a domain concept (issue title, refactor proposal, hypothesis, test name), use the term as defined in `CONTEXT.md`. Don't drift to synonyms the glossary explicitly avoids (e.g. use "Job" not "Schedule" or "Cronjob"; "Run" not "Execution"; "Operator" not "User").

If the concept you need isn't in the glossary yet, that's a signal: either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/grill-with-docs`).

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts ADR-014 (two-lane dispatch), but worth reopening because…_

A deviation requires a new ADR plus an audit-allowlist edit, per [AGENTS.md](../../AGENTS.md) "Locked decisions".
