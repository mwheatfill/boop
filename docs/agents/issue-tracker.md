# Issue tracker: GitHub

Issues and PRDs for this repo live as GitHub issues on [`mwheatfill/boop`](https://github.com/mwheatfill/boop). Use the `gh` CLI for all operations.

## Conventions

- **Create an issue**: `gh issue create --title "..." --body "..."`. Use a heredoc for multi-line bodies.
- **Read an issue**: `gh issue view <number> --comments`.
- **List issues**: `gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'` with appropriate `--label` and `--state` filters.
- **Comment on an issue**: `gh issue comment <number> --body "..."`
- **Apply / remove labels**: `gh issue edit <number> --add-label "..."` / `--remove-label "..."`
- **Close**: `gh issue close <number> --comment "..."`

Infer the repo from `git remote -v`; `gh` does this automatically when run inside a clone.

## When a skill says "publish to the issue tracker"

Create a GitHub issue.

## When a skill says "fetch the relevant ticket"

Run `gh issue view <number> --comments`.

## PRD lifecycle (umbrella + children)

PRDs are GitHub issues. They come in two shapes:

- **One-PR PRDs** (small enough to land in a single PR). The implementing PR's body includes `Closes #<prd>`; GitHub auto-closes the PRD on merge. Prior art: PRDs #1, #3.
- **Decomposed PRDs** (split into child issues via `/to-issues`). The umbrella PRD stays open while the children land; closing follows two mechanics:

  1. The umbrella's body carries a `## Tracked work` checklist with one row per child issue:

     ```markdown
     ## Tracked work

     - [ ] #17 — Slice 1: short title
     - [ ] #18 — Slice 2: short title
     ```

     GitHub auto-checks each box when its referenced issue closes. The umbrella visibly tracks progress while children are in flight.

  2. The PR that lands the **last** child issue includes `Closes #<umbrella>` alongside its own `Closes #<child>` — auto-closing both on merge. Before merge, post a recap comment on the umbrella listing each slice → child issue → implementing PR. The recap is the audit trail; the auto-close keeps state clean.

If new child issues surface mid-flight, edit the umbrella's checklist to add them. The lifecycle still terminates correctly because the auto-close fires only on the actual last `Closes #` reference.
