import type { ReactNode } from 'react'

interface PropertiesPanelShellProps {
  isLoading: boolean
  missing: boolean
  missingLabel: string
  children: ReactNode
}

export function PropertiesPanelShell({
  isLoading,
  missing,
  missingLabel,
  children,
}: PropertiesPanelShellProps) {
  if (isLoading) {
    return <p className="px-2 text-sm text-muted-foreground">Loading…</p>
  }
  if (missing) {
    return <p className="px-2 text-sm text-muted-foreground">{missingLabel}</p>
  }
  return <div className="flex flex-col px-2">{children}</div>
}
