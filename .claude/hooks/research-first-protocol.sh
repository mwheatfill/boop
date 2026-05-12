#!/usr/bin/env bash
# UserPromptSubmit hook. Injects the research-first protocol into agent context
# before every user message. Plain stdout = additionalContext for the upcoming turn.
# Wired in .claude/settings.json. See AGENTS.md → "Doc resolution" for the
# resolution order this protocol points at.
#
# To disable temporarily: rename or chmod -x this file.
# To audit/edit: open /hooks in Claude Code, or edit .claude/settings.json directly.

cat <<'PROTOCOL'
RESEARCH-FIRST PROTOCOL (re-anchored each turn; overrides skim-past-the-rules behavior).

Before producing code or edits touching any external runtime, framework, library, vendor service, or tool:

1. NAME the externals the task touches. Be specific:
   "Cloudflare Workers + wrangler.jsonc + GitHub Actions deploy"
   not "the backend."

2. CITE the current-docs source you'll consult per AGENTS.md "Doc resolution".
   Name it specifically:
   "Intent skill @tanstack/react-router#routing"
   "the cloudflare-docs MCP"
   "https://ui.shadcn.com/llms.txt"
   not "the docs."

3. CONSULT. Actually invoke the tool. Do not claim consultation you did not perform.
   The user will check.

4. APPLY. Produce code, citing what you used:
   "Per cloudflare-docs MCP search 'tanstack workers deploy', the canonical
   pattern is cloudflare/wrangler-action@v3. Applying that here."

ESCAPE CLAUSES. State which one applies, then proceed:
- TRIVIAL: pure rename / format / internal refactor with no external-API surface.
- ALREADY-CONSULTED: source S was consulted earlier this session for this exact
  concern. Cite the prior turn.
- NO-SOURCE: lookup-order.md exhausted, no current docs found; falling back to
  training data, FLAGGED FOR USER REVIEW.

HARD PROHIBITIONS:
- No silent training-data application. If you consulted nothing, say NO-SOURCE
  so the user can intervene before code ships.
- No workaround flags or hand-rolled patterns (e.g., wrangler --config X --env="",
  custom cross-job artifact passing, hand-rolling a primitive shadcn ships) when
  a framework guide documents a canonical alternative. Re-resolve from the top of
  lookup-order before committing. See lookup-order.md "Don't".
- No multi-line comments defending a workaround. If a step needs >1 line of
  comment to justify unusual flags, you missed a higher layer. Re-resolve.

UI ADDENDUM (when the task touches src/components/**, src/routes/**, or src/styles/**):
- DESIGN.md is a REQUIRED CITE source alongside Intent skills / MCPs / vendor docs.
  Name "DESIGN.md § N <section-title>" (e.g., "DESIGN.md § 3 Visual tokens" or
  "DESIGN.md § 9 Empty states") in the CITE step.
- Use TOKEN classes, never palette classes. text-primary not text-blue-500.
  bg-card not bg-zinc-900. text-success/warning/info/destructive not
  text-green-600/amber-500/blue-500/red-500. Arbitrary colors (text-[#abc],
  bg-[oklch(...)]) and hardcoded JSX color literals are forbidden.
- scripts/audit-patterns/design.ts enforces DESIGN.md § 12 anti-patterns at CI
  time. Failing them is a CI failure, not advisory.
PROTOCOL
