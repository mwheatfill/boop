import { CalendarIcon, ChevronDown } from 'lucide-react'
import { useState } from 'react'
import type { DateRange } from 'react-day-picker'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TRIGGER_SOURCES } from '@/lib/runs/filter-schema'
import type { Customer } from '@/shared/schemas/customer'
import { FAILURE_KINDS, RUN_OUTCOMES, RUN_STATUSES } from '@/shared/schemas/run'

type StringArray = string[] | undefined

export interface RunsFilters {
  customer?: string[] | undefined
  status?: string[] | undefined
  outcome?: string[] | undefined
  failureKind?: string[] | undefined
  triggerSource?: string[] | undefined
  range: '24h' | '7d' | 'custom'
  from?: string | undefined
  to?: string | undefined
}

interface RunsFilterChipsProps {
  filters: RunsFilters
  customers: Pick<Customer, 'slug' | 'name'>[]
  onChange: (next: Partial<RunsFilters>) => void
}

function toggle(arr: StringArray, value: string): string[] | undefined {
  const current = arr ?? []
  if (current.includes(value)) {
    const next = current.filter((v) => v !== value)
    return next.length === 0 ? undefined : next
  }
  return [...current, value]
}

function isActive(arr: StringArray, value: string): boolean {
  return arr?.includes(value) ?? false
}

function dateRange(filters: RunsFilters): DateRange | undefined {
  if (filters.range !== 'custom') return undefined
  let from: Date | undefined
  let to: Date | undefined
  if (filters.from) {
    const d = new Date(filters.from)
    if (!Number.isNaN(d.getTime())) from = d
  }
  if (filters.to) {
    const d = new Date(filters.to)
    if (!Number.isNaN(d.getTime())) to = d
  }
  if (!from && !to) return undefined
  return { from, to }
}

function formatRangeLabel(filters: RunsFilters): string {
  if (filters.range === '24h') return 'Last 24h'
  if (filters.range === '7d') return 'Last 7d'
  const r = dateRange(filters)
  if (r?.from && r?.to) {
    return `${r.from.toLocaleDateString()} – ${r.to.toLocaleDateString()}`
  }
  if (r?.from) return `${r.from.toLocaleDateString()} – …`
  return 'Custom'
}

export function RunsFilterChips({ filters, customers, onChange }: RunsFilterChipsProps) {
  const [customRangeOpen, setCustomRangeOpen] = useState(false)
  const customerSelections = new Set(filters.customer ?? [])
  const showFailureKind = filters.outcome?.includes('failure') ?? false

  return (
    <div className="flex flex-wrap items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="outline" size="xs">
              Customer
              {customerSelections.size > 0 ? (
                <span className="ml-1 rounded bg-primary/15 px-1 text-[10px]">
                  {customerSelections.size}
                </span>
              ) : null}
              <ChevronDown aria-hidden className="ml-1" />
            </Button>
          }
        />
        <DropdownMenuContent align="start" className="max-h-64 overflow-y-auto">
          {customers.length === 0 ? (
            <p className="px-2 py-1.5 text-xs text-muted-foreground">No Customers</p>
          ) : (
            customers.map((c) => (
              <DropdownMenuCheckboxItem
                key={c.slug}
                checked={customerSelections.has(c.slug)}
                onCheckedChange={() => onChange({ customer: toggle(filters.customer, c.slug) })}
              >
                {c.name}
              </DropdownMenuCheckboxItem>
            ))
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <ChipGroup
        label="Status"
        values={RUN_STATUSES}
        selected={filters.status}
        onToggle={(v) => onChange({ status: toggle(filters.status, v) })}
      />
      <ChipGroup
        label="Outcome"
        values={RUN_OUTCOMES}
        selected={filters.outcome}
        onToggle={(v) => onChange({ outcome: toggle(filters.outcome, v) })}
      />
      {showFailureKind ? (
        <ChipGroup
          label="Failure"
          values={FAILURE_KINDS}
          selected={filters.failureKind}
          onToggle={(v) => onChange({ failureKind: toggle(filters.failureKind, v) })}
        />
      ) : null}
      <ChipGroup
        label="Trigger"
        values={TRIGGER_SOURCES}
        selected={filters.triggerSource}
        onToggle={(v) => onChange({ triggerSource: toggle(filters.triggerSource, v) })}
      />

      <Tabs
        value={filters.range}
        onValueChange={(v) => onChange({ range: (v ?? '24h') as RunsFilters['range'] })}
      >
        <TabsList>
          <TabsTrigger value="24h">24h</TabsTrigger>
          <TabsTrigger value="7d">7d</TabsTrigger>
          <TabsTrigger value="custom">Custom</TabsTrigger>
        </TabsList>
      </Tabs>

      {filters.range === 'custom' ? (
        <Popover open={customRangeOpen} onOpenChange={setCustomRangeOpen}>
          <PopoverTrigger
            render={
              <Button variant="outline" size="xs">
                <CalendarIcon aria-hidden className="mr-1" />
                {formatRangeLabel(filters)}
              </Button>
            }
          />
          <PopoverContent align="start" className="w-auto p-0">
            <Calendar
              mode="range"
              numberOfMonths={2}
              selected={dateRange(filters)}
              onSelect={(range) => {
                const next: Partial<RunsFilters> = {}
                if (range?.from) next.from = range.from.toISOString()
                if (range?.to) next.to = range.to.toISOString()
                onChange(next)
              }}
            />
          </PopoverContent>
        </Popover>
      ) : null}
    </div>
  )
}

interface ChipGroupProps {
  label: string
  values: readonly string[]
  selected: StringArray
  onToggle: (value: string) => void
}

function ChipGroup({ label, values, selected, onToggle }: ChipGroupProps) {
  return (
    <div className="flex items-center gap-1 rounded-md border border-border px-1 py-0.5">
      <span className="px-1 text-xs text-muted-foreground">{label}:</span>
      {values.map((v) => (
        <Button
          key={v}
          type="button"
          size="xs"
          variant={isActive(selected, v) ? 'default' : 'ghost'}
          onClick={() => onToggle(v)}
        >
          {v}
        </Button>
      ))}
    </div>
  )
}
