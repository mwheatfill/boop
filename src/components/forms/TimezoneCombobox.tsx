'use client'
import { Check } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { SearchableCombobox } from '@/components/forms/SearchableCombobox'
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
  const allIanas = listAllTimezones()
  const curatedIanas = new Set(CURATED_TIMEZONES.map((o) => o.iana))
  const derived = allIanas
    .filter((iana) => !curatedIanas.has(iana))
    .map((iana) => describeTimezone(iana))
    .sort((a, b) => a.city.localeCompare(b.city))
  return [...CURATED_TIMEZONES, ...derived]
}

function optionKeywords(option: TimezoneOption, offset: string): string[] {
  const keywords = [option.iana]
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
  const [now, setNow] = useState(() => new Date())
  const [open, setOpen] = useState(false)

  const selectedOption = byIana.get(value) ?? describeTimezone(value)

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

  const offsets = useMemo(() => {
    const out = new Map<string, string>()
    for (const option of [...CURATED_TIMEZONES, ...recents]) {
      out.set(option.iana, formatTimezoneOffset(option.iana, now))
    }
    return out
  }, [recents, now])

  return (
    <SearchableCombobox<TimezoneOption>
      label={label}
      {...(required ? { required: true } : {})}
      {...(disabled ? { disabled: true } : {})}
      items={options}
      recents={recents}
      value={selectedOption}
      onValueChange={(next) => {
        if (!next) return
        onValueChange(next.iana)
        recordUse(next)
      }}
      getId={(o) => o.iana}
      getLabel={(o) => o.city}
      onOpenChange={setOpen}
      searchKeywords={(o) => optionKeywords(o, offsets.get(o.iana) ?? '')}
      placeholder="Search timezones…"
      popupWidthClass="w-[22rem]"
      recentSectionLabel="Recent"
      allSectionLabel="All zones"
      emptyMessage="No matching timezones."
      renderRow={(option) => (
        <TimezoneRow
          option={option}
          offset={offsets.get(option.iana) ?? formatTimezoneOffset(option.iana, now)}
          clock={
            recents.some((r) => r.iana === option.iana) ? formatTimezoneClock(option.iana, now) : ''
          }
          selected={option.iana === value}
        />
      )}
    />
  )
}

interface TimezoneRowProps {
  option: TimezoneOption
  offset: string
  clock: string
  selected: boolean
}

function TimezoneRow({ option, offset, clock, selected }: TimezoneRowProps) {
  return (
    <>
      <span className="flex min-w-0 flex-1 items-center gap-2">
        {selected ? (
          <Check className="size-3 text-primary" aria-hidden />
        ) : (
          <span className="inline-block size-3" aria-hidden />
        )}
        <span className="flex min-w-0 flex-col">
          <span className="flex items-baseline gap-2">
            <span className="truncate text-foreground">{option.city}</span>
            {option.commonName ? (
              <span className="truncate text-xs text-muted-foreground">{option.commonName}</span>
            ) : null}
          </span>
          <span className="truncate font-mono text-[10px] uppercase tracking-wide text-muted-foreground/70">
            {option.iana}
          </span>
        </span>
      </span>
      <span className="ml-2 flex shrink-0 flex-col items-end gap-0.5 font-mono text-[10px] text-muted-foreground">
        {offset ? <span>{offset}</span> : null}
        {clock ? <span className="text-foreground">{clock}</span> : null}
      </span>
    </>
  )
}
