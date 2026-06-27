import {
  Activity,
  CopyPlus,
  Database,
  FileText,
  GitBranch,
  Receipt,
  Sparkles,
  Timer,
  Trash2,
  Webhook,
} from 'lucide-react'
import type { ComponentType } from 'react'
import { Badge } from '@/components/ui/badge'
import { humanizeTemplateSchedule, templateTagLabel } from '@/lib/job-templates/display'
import { cn } from '@/lib/utils'
import type { JobTemplate } from '@/shared/schemas/job-template'

const ICONS: Record<string, ComponentType<{ className?: string; 'aria-hidden'?: boolean }>> = {
  activity: Activity,
  'copy-plus': CopyPlus,
  database: Database,
  'file-text': FileText,
  'git-branch': GitBranch,
  receipt: Receipt,
  sparkles: Sparkles,
  timer: Timer,
  'trash-2': Trash2,
  webhook: Webhook,
}

interface TemplateCardProps {
  template: JobTemplate
  onSelect: (template: JobTemplate) => void
  compact?: boolean
}

export function TemplateCard({ template, onSelect, compact = false }: TemplateCardProps) {
  const Icon = ICONS[template.icon ?? ''] ?? Sparkles
  return (
    <button
      type="button"
      onClick={() => onSelect(template)}
      className={cn(
        'group relative flex min-h-56 flex-col items-center gap-3 rounded-lg border border-border bg-card p-5 text-center transition-colors hover:border-primary/30 hover:bg-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        compact && 'min-h-48 p-4',
      )}
    >
      {template.builtIn ? (
        <Badge variant="secondary" className="absolute right-3 top-3 text-[10px] uppercase">
          Starter
        </Badge>
      ) : null}
      {template.workspaceId ? (
        <span className="absolute left-3 top-3 rounded-md border border-border px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
          Workspace
        </span>
      ) : null}
      <span className="flex size-14 items-center justify-center rounded-full bg-secondary/70 text-foreground">
        <Icon className="size-7" aria-hidden />
      </span>
      <span className="flex flex-col gap-1">
        <span className="text-base font-semibold text-foreground">{template.name}</span>
        {template.description ? (
          <span className="line-clamp-2 text-sm text-muted-foreground">{template.description}</span>
        ) : null}
      </span>
      <span className="text-xs text-muted-foreground">{humanizeTemplateSchedule(template)}</span>
      <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
        {templateTagLabel(template.tag)}
      </span>
      <span className="mt-auto text-sm font-medium text-primary group-hover:underline">
        Use this
      </span>
    </button>
  )
}
