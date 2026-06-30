import { Clock } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'

// A range is "all" or "<N><unit>" (24h, 7d, 45m, 3mo) — see runs/filter-schema.
const UNITS = [
  { code: 'm', plural: 'minutes', singular: 'minute' },
  { code: 'h', plural: 'hours', singular: 'hour' },
  { code: 'd', plural: 'days', singular: 'day' },
  { code: 'w', plural: 'weeks', singular: 'week' },
  { code: 'mo', plural: 'months', singular: 'month' },
] as const

const PRESETS = [
  { range: '1h', label: 'Last hour' },
  { range: '24h', label: 'Last 24 hours' },
  { range: '7d', label: 'Last 7 days' },
  { range: '30d', label: 'Last 30 days' },
  { range: 'all', label: 'All time' },
] as const

export function rangeLabel(range: string): string {
  const preset = PRESETS.find((p) => p.range === range)
  if (preset) return preset.label
  const m = /^(\d+)(m|h|d|w|mo)$/.exec(range)
  if (!m) return 'All time'
  const n = Number(m[1])
  const unit = UNITS.find((u) => u.code === m[2])
  if (!unit) return 'All time'
  return `Last ${n} ${n === 1 ? unit.singular : unit.plural}`
}

export function DateRangeFilter({
  value,
  onChange,
}: {
  value: string
  onChange: (range: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState('30')
  const [unit, setUnit] = useState<string>('m')

  const apply = (range: string) => {
    onChange(range)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button variant="outline" size="sm" className="h-8" />}>
        <Clock className="size-4" />
        {rangeLabel(value)}
      </PopoverTrigger>
      <PopoverContent align="end" className="flex w-60 flex-col gap-1 p-2">
        {PRESETS.map((preset) => (
          <Button
            key={preset.range}
            type="button"
            variant={value === preset.range ? 'secondary' : 'ghost'}
            size="sm"
            className="justify-start"
            onClick={() => apply(preset.range)}
          >
            {preset.label}
          </Button>
        ))}
        <Separator className="my-1" />
        <div className="flex flex-col gap-1.5 px-1">
          <Label className="text-xs text-muted-foreground">Custom</Label>
          <div className="flex items-center gap-1.5">
            <span className="text-sm text-muted-foreground">Last</span>
            <Input
              type="number"
              min={1}
              value={amount}
              onChange={(e) => setAmount(e.currentTarget.value)}
              className="h-8 w-16"
              aria-label="Amount"
            />
            <Select value={unit} onValueChange={(v) => setUnit(v ?? 'm')}>
              <SelectTrigger className="h-8 flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {UNITS.map((u) => (
                  <SelectItem key={u.code} value={u.code}>
                    {u.plural}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            type="button"
            size="sm"
            onClick={() => apply(`${Math.max(1, Number(amount) || 1)}${unit}`)}
          >
            Apply
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
