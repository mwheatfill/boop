// Shared types for the audit-patterns scripts. Each audit script
// returns an AuditResult; the runner aggregates them into a single
// report and exits non-zero on any error-severity finding.

export type AuditName = 'shadcn' | 'tanstack' | 'preferences'
export type Severity = 'error' | 'warn'

export interface Finding {
  audit: AuditName
  severity: Severity
  /** Repo-relative path. */
  file: string
  /** Optional 1-based line number. */
  line?: number
  /** Action-oriented: "what's wrong → what to do". */
  message: string
  /** Optional URL to the canonical source for the rule. */
  source?: string
}

export interface AuditResult {
  audit: AuditName
  findings: Finding[]
  /** True if the audit ran cleanly (regardless of findings). */
  ok: boolean
  /** Set if the audit itself errored before producing findings. */
  error?: string
}
