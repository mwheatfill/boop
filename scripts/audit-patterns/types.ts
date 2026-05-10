// Shared types for the audit-patterns scripts. Each audit script returns
// an array of Findings; the runner aggregates them into a single report,
// prints the formatted output, and exits non-zero when any audit finds
// drift. Findings carry enough context for a PR comment to point a
// reviewer (or an agent) at the exact spot to fix.

export type Severity = 'error' | 'warn'

export interface Finding {
  /** Which audit found this (shadcn | tanstack | preferences). */
  audit: string
  /** error fails the gate; warn surfaces but doesn't fail. */
  severity: Severity
  /** Repo-relative path to the file that drifted. */
  file: string
  /** Optional 1-based line number, when known. */
  line?: number
  /** Short, action-oriented description: "what's wrong → what to do". */
  message: string
  /** Optional URL to the canonical source for the rule. */
  source?: string
}

export interface AuditResult {
  audit: string
  findings: Finding[]
  /** True if the audit ran cleanly (regardless of findings). */
  ok: boolean
  /** Set if the audit itself errored before producing findings. */
  error?: string
}
