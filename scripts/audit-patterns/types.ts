export type AuditName = 'shadcn' | 'tanstack' | 'preferences'
export type Severity = 'error' | 'warn'

export interface Finding {
  audit: AuditName
  severity: Severity
  file: string
  line?: number
  message: string
  source?: string
}

export interface AuditResult {
  audit: AuditName
  findings: Finding[]
  ok: boolean
  error?: string
}
