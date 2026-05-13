import { SendHorizonal } from 'lucide-react'
import type { ReactNode } from 'react'
import { StatusBadge } from '@/components/StatusBadge'
import { Button } from '@/components/ui/button'
import type { Channel } from '@/shared/schemas/channel'

function testStatusToneClass(status: Channel['lastTestAlertStatus']): string {
  if (status === 'delivered') return 'text-success'
  if (status === 'failed') return 'text-destructive'
  return 'text-warning'
}

interface ActionState {
  onClick: () => void
  isPending: boolean
}

interface ChannelDetailViewProps {
  channel: Channel
  eyebrow: string
  backLink: ReactNode
  editButton: ReactNode
  archive: ActionState
  restore: ActionState
  sendTest: ActionState
}

export function ChannelDetailView({
  channel,
  eyebrow,
  backLink,
  editButton,
  archive,
  restore,
  sendTest,
}: ChannelDetailViewProps) {
  const isActive = channel.status === 'active'
  return (
    <div className="flex flex-col gap-6">
      {backLink}
      <header className="flex items-start justify-between">
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {eyebrow}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">{channel.name}</h1>
          <p className="text-sm text-muted-foreground">
            <span className="font-mono">{channel.slug}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={channel.status} />
          <Button
            size="sm"
            variant="outline"
            disabled={!isActive || sendTest.isPending}
            onClick={sendTest.onClick}
          >
            <SendHorizonal aria-hidden /> Send test alert
          </Button>
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
        <h2 className="text-sm font-medium">Last test alert</h2>
        {channel.lastTestAlertAt ? (
          <p className="text-sm text-muted-foreground">
            {new Date(channel.lastTestAlertAt).toLocaleString()} ·{' '}
            <span className={testStatusToneClass(channel.lastTestAlertStatus)}>
              {channel.lastTestAlertStatus ?? 'pending'}
            </span>
            {channel.lastTestAlertReason ? ` — ${channel.lastTestAlertReason}` : null}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">No test alert sent yet.</p>
        )}
      </section>

      <section className="flex flex-col gap-2 rounded-md border border-border bg-muted/20 p-4">
        <h2 className="text-sm font-medium">Config</h2>
        <pre className="overflow-x-auto rounded bg-card p-3 font-mono text-xs">
          {JSON.stringify(channel.config, null, 2)}
        </pre>
      </section>
    </div>
  )
}
