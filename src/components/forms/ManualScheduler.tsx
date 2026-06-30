import { TimezoneCombobox } from '@/components/forms/TimezoneCombobox'
import { Button } from '@/components/ui/button'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type Frequency = 'minutes' | 'hourly' | 'daily' | 'weekly' | 'monthly'

interface Builder {
  frequency: Frequency
  everyMinutes: number
  minute: number
  hour: number
  daysOfWeek: number[]
  dayOfMonth: number
}

const BASE: Omit<Builder, 'frequency'> = {
  everyMinutes: 5,
  minute: 0,
  hour: 9,
  daysOfWeek: [1],
  dayOfMonth: 1,
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const EVERY_MINUTES = [1, 2, 5, 10, 15, 30]
const FREQUENCY_LABELS: Record<Frequency, string> = {
  minutes: 'Every few minutes',
  hourly: 'Hourly',
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
}

function builderToCron(b: Builder): string {
  switch (b.frequency) {
    case 'minutes':
      return `*/${b.everyMinutes} * * * *`
    case 'hourly':
      return `${b.minute} * * * *`
    case 'daily':
      return `${b.minute} ${b.hour} * * *`
    case 'weekly': {
      const days = [...b.daysOfWeek].sort((a, c) => a - c)
      return `${b.minute} ${b.hour} * * ${days.length ? days.join(',') : '1'}`
    }
    case 'monthly':
      return `${b.minute} ${b.hour} ${b.dayOfMonth} * *`
  }
}

function cronToBuilder(cron: string): Builder | null {
  const parts = cron.trim().split(/\s+/)
  if (parts.length !== 5) return null
  const [min, hr, dom, mon, dow] = parts as [string, string, string, string, string]
  const num = (s: string) => (/^\d+$/.test(s) ? Number(s) : null)

  if (mon === '*' && dom === '*' && hr === '*' && dow === '*') {
    const every = min.match(/^\*\/(\d+)$/)
    if (every) return { ...BASE, frequency: 'minutes', everyMinutes: Number(every[1]) }
    const m = num(min)
    if (m !== null) return { ...BASE, frequency: 'hourly', minute: m }
    return null
  }
  const m = num(min)
  const h = num(hr)
  if (m === null || h === null) return null
  if (mon === '*' && dom === '*' && dow === '*')
    return { ...BASE, frequency: 'daily', minute: m, hour: h }
  if (mon === '*' && dom === '*' && dow !== '*') {
    const days = dow.split(',').map(num)
    if (days.some((d) => d === null)) return null
    return { ...BASE, frequency: 'weekly', minute: m, hour: h, daysOfWeek: days as number[] }
  }
  if (mon === '*' && dow === '*') {
    const d = num(dom)
    if (d !== null) return { ...BASE, frequency: 'monthly', minute: m, hour: h, dayOfMonth: d }
  }
  return null
}

interface ManualSchedulerProps {
  cronExpression: string
  timezone: string
  onChange: (cron: string) => void
  onTimezone: (timezone: string) => void
}

export function ManualScheduler({
  cronExpression,
  timezone,
  onChange,
  onTimezone,
}: ManualSchedulerProps) {
  const builder = cronToBuilder(cronExpression)
  const apply = (next: Builder) => onChange(builderToCron(next))
  const patch = (partial: Partial<Builder>) => {
    if (builder) apply({ ...builder, ...partial })
  }

  return (
    <div className="flex flex-col gap-3">
      <Field>
        <FieldLabel>How often</FieldLabel>
        <Select
          value={builder?.frequency ?? ''}
          onValueChange={(f) => apply({ ...BASE, frequency: f as Frequency })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Choose a frequency" />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(FREQUENCY_LABELS) as Frequency[]).map((f) => (
              <SelectItem key={f} value={f}>
                {FREQUENCY_LABELS[f]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      {builder?.frequency === 'minutes' ? (
        <Field>
          <FieldLabel>Run every</FieldLabel>
          <Select
            value={String(builder.everyMinutes)}
            onValueChange={(v) => patch({ everyMinutes: Number(v) })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EVERY_MINUTES.map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n === 1 ? 'minute' : `${n} minutes`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      ) : null}

      {builder?.frequency === 'hourly' ? (
        <Field>
          <FieldLabel htmlFor="manual-minute">Minutes past the hour</FieldLabel>
          <Input
            id="manual-minute"
            type="number"
            min={0}
            max={59}
            value={builder.minute}
            onChange={(e) => patch({ minute: clamp(Number(e.currentTarget.value), 0, 59) })}
          />
        </Field>
      ) : null}

      {builder?.frequency === 'monthly' ? (
        <Field>
          <FieldLabel htmlFor="manual-dom">On day of month</FieldLabel>
          <Input
            id="manual-dom"
            type="number"
            min={1}
            max={28}
            value={builder.dayOfMonth}
            onChange={(e) => patch({ dayOfMonth: clamp(Number(e.currentTarget.value), 1, 28) })}
          />
        </Field>
      ) : null}

      {builder?.frequency === 'weekly' ? (
        <Field>
          <FieldLabel>On days</FieldLabel>
          <div className="flex flex-wrap gap-1.5">
            {DAY_LABELS.map((label, day) => {
              const on = builder.daysOfWeek.includes(day)
              return (
                <Button
                  key={label}
                  type="button"
                  size="xs"
                  variant={on ? 'default' : 'outline'}
                  onClick={() =>
                    patch({
                      daysOfWeek: on
                        ? builder.daysOfWeek.filter((d) => d !== day)
                        : [...builder.daysOfWeek, day],
                    })
                  }
                >
                  {label}
                </Button>
              )
            })}
          </div>
        </Field>
      ) : null}

      {builder && builder.frequency !== 'minutes' && builder.frequency !== 'hourly' ? (
        <Field>
          <FieldLabel htmlFor="manual-time">At</FieldLabel>
          <Input
            id="manual-time"
            type="time"
            className="w-36"
            value={`${pad(builder.hour)}:${pad(builder.minute)}`}
            onChange={(e) => {
              const [h, m] = e.currentTarget.value.split(':').map(Number)
              patch({ hour: clamp(h ?? 0, 0, 23), minute: clamp(m ?? 0, 0, 59) })
            }}
          />
        </Field>
      ) : null}

      <TimezoneCombobox value={timezone} onValueChange={onTimezone} />
    </div>
  )
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function clamp(n: number, min: number, max: number): number {
  if (Number.isNaN(n)) return min
  return Math.min(max, Math.max(min, n))
}
