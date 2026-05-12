import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { useEntityModalGuard } from './use-entity-modal-guard'

interface ActionConfig {
  label: string
  onClick: () => void | Promise<void>
  disabled?: boolean
  loading?: boolean
}

interface CreateAnotherConfig {
  enabled: boolean
  onChange: (value: boolean) => void
}

export interface EntityModalProps {
  open: boolean
  onClose: () => void
  title: ReactNode
  description?: ReactNode
  primaryAction: ActionConfig
  secondaryAction?: ActionConfig
  createAnother?: CreateAnotherConfig
  dirty?: boolean
  children: ReactNode
}

export function EntityModal({
  open,
  onClose,
  title,
  description,
  primaryAction,
  secondaryAction,
  createAnother,
  dirty = false,
  children,
}: EntityModalProps) {
  const guard = useEntityModalGuard({ isDirty: dirty })
  const blocked = guard.status === 'blocked'

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <DialogContent
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !primaryAction.disabled) {
            e.preventDefault()
            void primaryAction.onClick()
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>

        <div className="flex flex-col gap-4">{children}</div>

        {blocked ? (
          <div className="flex items-center justify-between gap-3 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm">
            <p className="text-foreground">Discard changes?</p>
            <div className="flex items-center gap-2">
              <Button size="xs" variant="outline" onClick={guard.reset}>
                Keep editing
              </Button>
              <Button size="xs" variant="destructive" onClick={guard.proceed}>
                Discard
              </Button>
            </div>
          </div>
        ) : null}

        <DialogFooter>
          <div className="flex items-center gap-3">
            {createAnother ? (
              <Label className="flex items-center gap-2 text-xs text-muted-foreground">
                <Switch
                  checked={createAnother.enabled}
                  onCheckedChange={createAnother.onChange}
                  aria-label="Create another after submit"
                />
                Create another
              </Label>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => (secondaryAction?.onClick ?? onClose)()}
            >
              {secondaryAction?.label ?? 'Cancel'}
            </Button>
            <Button
              size="sm"
              onClick={() => void primaryAction.onClick()}
              disabled={primaryAction.disabled || primaryAction.loading}
              className={cn(primaryAction.loading && 'cursor-progress')}
            >
              {primaryAction.loading ? 'Saving…' : primaryAction.label}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
