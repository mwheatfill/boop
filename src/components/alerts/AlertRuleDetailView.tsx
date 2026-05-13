import type { ReactNode } from 'react'
import { StatusBadge } from '@/components/StatusBadge'
import { Button } from '@/components/ui/button'
import { type AlertRule, summarizeRuleConfig } from '@/shared/schemas/alert-rule'
import type { Channel } from '@/shared/schemas/channel'

interface ActionState {
  onClick: () => void
  isPending: boolean
}

interface AlertRuleDetailViewProps {
  rule: AlertRule
  eyebrow: string
  channelById: Map<string, Channel>
  backLink: ReactNode
  editButton: ReactNode
  archive: ActionState
  restore: ActionState
}

export function AlertRuleDetailView({
  rule,
  eyebrow,
  channelById,
  backLink,
  editButton,
  archive,
  restore,
}: AlertRuleDetailViewProps) {
  const isActive = rule.status === 'active'
  return (
    <div className="flex flex-col gap-6">
      {backLink}
      <header className="flex items-start justify-between">
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {eyebrow}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">{rule.name}</h1>
          <p className="text-sm text-muted-foreground">
            <span className="font-mono">{rule.slug}</span> · {summarizeRuleConfig(rule.config)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={rule.status} />
          {isActive ? editButton : null}
          {isActive ? (
            <Button
              size="sm"
              variant="outline"
              disabled={archive.isPending}
              onClick={archive.onClick}
            >
              Archive
            </Button>
          ) : (
            <Button size="sm" disabled={restore.isPending} onClick={restore.onClick}>
              Restore
            </Button>
          )}
        </div>
      </header>

      <section className="flex flex-col gap-2 rounded-md border border-border bg-muted/20 p-4">
        <h2 className="text-sm font-medium">Routes to</h2>
        <ul className="flex flex-col gap-1 text-sm">
          {rule.channelIds.map((id) => {
            const channel = channelById.get(id)
            return (
              <li key={id} className="flex items-center gap-2">
                <span className="text-foreground">{channel?.name ?? id}</span>
                {channel && channel.status !== 'active' ? (
                  <span className="text-xs text-warning">(archived — update routing)</span>
                ) : null}
              </li>
            )
          })}
        </ul>
      </section>

      <section className="flex flex-col gap-2 rounded-md border border-border bg-muted/20 p-4">
        <h2 className="text-sm font-medium">Last fired</h2>
        <p className="text-sm text-muted-foreground">
          {rule.lastFiredAt ? new Date(rule.lastFiredAt).toLocaleString() : 'Never fired yet.'}
        </p>
      </section>
    </div>
  )
}
