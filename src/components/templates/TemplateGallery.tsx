import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Input } from '@/components/ui/input'
import { TEMPLATE_TAG_LABELS } from '@/lib/job-templates/display'
import { cn } from '@/lib/utils'
import type { JobTemplate, JobTemplateTag } from '@/shared/schemas/job-template'
import { TemplateCard } from './TemplateCard'

const FILTERS: Array<JobTemplateTag | 'all'> = [
  'all',
  'backups',
  'health-checks',
  'reports',
  'integrations',
  'maintenance',
  'custom',
]

interface TemplateGalleryProps {
  templates: JobTemplate[]
  onSelect: (template: JobTemplate) => void
  compact?: boolean
}

function matches(template: JobTemplate, tag: JobTemplateTag | 'all', query: string): boolean {
  if (tag !== 'all' && template.tag !== tag) return false
  const q = query.trim().toLowerCase()
  if (!q) return true
  return [template.name, template.description ?? '', template.tag, template.targetRef]
    .join(' ')
    .toLowerCase()
    .includes(q)
}

export function TemplateGallery({ templates, onSelect, compact = false }: TemplateGalleryProps) {
  const [tag, setTag] = useState<JobTemplateTag | 'all'>('all')
  const [query, setQuery] = useState('')

  const filtered = useMemo(
    () => templates.filter((template) => matches(template, tag, query)),
    [templates, tag, query],
  )
  const starters = filtered.filter((template) => template.builtIn)
  const saved = filtered.filter((template) => !template.builtIn)
  const gridClass = compact
    ? 'grid grid-cols-1 gap-3 sm:grid-cols-2'
    : 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            placeholder="Search templates"
            className="pl-8"
          />
        </div>
        <fieldset className="flex flex-wrap gap-2">
          <legend className="sr-only">Template filters</legend>
          {FILTERS.map((filter) => {
            const active = filter === tag
            const label = filter === 'all' ? 'All' : TEMPLATE_TAG_LABELS[filter]
            return (
              <button
                type="button"
                key={filter}
                onClick={() => setTag(filter)}
                aria-pressed={active}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  active
                    ? 'border-primary/30 bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground hover:bg-accent hover:text-foreground',
                )}
              >
                {label}
              </button>
            )
          })}
        </fieldset>
      </div>

      {starters.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium">Starter recipes</h2>
          <div className={gridClass}>
            {starters.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                onSelect={onSelect}
                compact={compact}
              />
            ))}
          </div>
        </section>
      ) : null}

      {saved.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium">Your templates</h2>
          <div className={gridClass}>
            {saved.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                onSelect={onSelect}
                compact={compact}
              />
            ))}
          </div>
        </section>
      ) : null}

      {filtered.length === 0 ? (
        <div className="rounded-md border border-border bg-muted/20 p-4 text-sm text-muted-foreground">
          No templates match this filter.{' '}
          <button
            type="button"
            className="text-primary hover:underline"
            onClick={() => setTag('all')}
          >
            Clear filters
          </button>
        </div>
      ) : null}
    </div>
  )
}
