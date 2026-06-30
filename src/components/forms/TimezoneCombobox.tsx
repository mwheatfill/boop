import { useEffect, useMemo, useState } from 'react'
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/components/ui/combobox'
import { Field, FieldLabel } from '@/components/ui/field'
import { PICKER_KEYS, PICKER_RECENT_LIMITS } from '@/lib/forms/picker-keys'
import { usePickerRecents } from '@/lib/forms/use-picker-recents'
import {
  CURATED_TIMEZONES,
  describeTimezone,
  formatTimezoneClock,
  formatTimezoneOffset,
  listAllTimezones,
  type TimezoneOption,
} from '@/lib/time/timezone-display'

interface TimezoneComboboxProps {
  label?: string
  required?: boolean
  disabled?: boolean
  value: string
  onValueChange: (value: string) => void
}

function buildOptions(): TimezoneOption[] {
  const curatedIanas = new Set(CURATED_TIMEZONES.map((o) => o.iana))
  const derived = listAllTimezones()
    .filter((iana) => !curatedIanas.has(iana))
    .map(describeTimezone)
    .sort((a, b) => a.city.localeCompare(b.city))
  return [...CURATED_TIMEZONES, ...derived]
}

function optionKeywords(option: TimezoneOption, offset: string): string[] {
  const keywords = [option.city, option.iana]
  if (option.region) keywords.push(option.region)
  if (option.commonName) keywords.push(option.commonName)
  if (offset) keywords.push(offset)
  return keywords
}

export function TimezoneCombobox({
  label = 'Timezone',
  required,
  disabled,
  value,
  onValueChange,
}: TimezoneComboboxProps) {
  const options = useMemo(buildOptions, [])
  const byIana = useMemo(() => new Map(options.map((o) => [o.iana, o])), [options])
  const [open, setOpen] = useState(false)
  const [now, setNow] = useState(() => new Date())

  const selected = byIana.get(value) ?? describeTimezone(value)

  const { recents, recordUse } = usePickerRecents<TimezoneOption>(
    PICKER_KEYS.recentTimezones,
    options,
    (o) => o.iana,
    PICKER_RECENT_LIMITS.timezones,
  )

  useEffect(() => {
    if (!open) return
    setNow(new Date())
    const tick = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(tick)
  }, [open])

  // Recents float to the top; the rest stay alphabetical from buildOptions.
  const recentIanas = useMemo(() => new Set(recents.map((r) => r.iana)), [recents])
  const ordered = useMemo(
    () => [...recents, ...options.filter((o) => !recentIanas.has(o.iana))],
    [recents, options, recentIanas],
  )
  const offsets = useMemo(() => {
    const out = new Map<string, string>()
    for (const o of ordered) out.set(o.iana, formatTimezoneOffset(o.iana, now))
    return out
  }, [ordered, now])

  return (
    <Field>
      {label ? <FieldLabel>{label}</FieldLabel> : null}
      <Combobox
        items={ordered}
        value={selected}
        onValueChange={(next: TimezoneOption | null) => {
          if (!next) return
          onValueChange(next.iana)
          recordUse(next)
        }}
        itemToStringLabel={(o: TimezoneOption) => o.city}
        isItemEqualToValue={(a: TimezoneOption, b: TimezoneOption) => a.iana === b.iana}
        open={open}
        onOpenChange={setOpen}
        disabled={disabled}
        filter={(o: TimezoneOption, query: string) => {
          const q = query.trim().toLowerCase()
          if (!q) return true
          return optionKeywords(o, offsets.get(o.iana) ?? '').some((k) =>
            k.toLowerCase().includes(q),
          )
        }}
      >
        <ComboboxInput
          placeholder="Search timezones…"
          showClear
          onFocus={(e) => e.currentTarget.select()}
          {...(required ? { 'aria-required': true } : {})}
        />
        <ComboboxContent className="w-[22rem]">
          <ComboboxEmpty>No matching timezones.</ComboboxEmpty>
          <ComboboxList>
            {(option: TimezoneOption) => {
              const offset = offsets.get(option.iana) ?? ''
              const clock = recentIanas.has(option.iana)
                ? formatTimezoneClock(option.iana, now)
                : ''
              return (
                <ComboboxItem key={option.iana} value={option}>
                  <span className="flex min-w-0 flex-col">
                    <span className="flex items-baseline gap-2">
                      <span className="truncate">{option.city}</span>
                      {option.commonName ? (
                        <span className="truncate text-xs text-muted-foreground">
                          {option.commonName}
                        </span>
                      ) : null}
                    </span>
                    <span className="truncate font-mono text-[10px] uppercase tracking-wide text-muted-foreground/70">
                      {option.iana}
                    </span>
                  </span>
                  <span className="ml-auto flex shrink-0 flex-col items-end gap-0.5 pr-4 font-mono text-[10px] text-muted-foreground">
                    {offset ? <span>{offset}</span> : null}
                    {clock ? <span className="text-foreground">{clock}</span> : null}
                  </span>
                </ComboboxItem>
              )
            }}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </Field>
  )
}
