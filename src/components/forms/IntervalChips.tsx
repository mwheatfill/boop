import { Button } from '@/components/ui/button'

const PRESETS: { label: string; seconds: number }[] = [
  { label: '30s', seconds: 30 },
  { label: '1m', seconds: 60 },
  { label: '5m', seconds: 300 },
  { label: '15m', seconds: 900 },
  { label: '1h', seconds: 3600 },
]

interface IntervalChipsProps {
  value: number
  onChange: (seconds: number) => void
}

export function IntervalChips({ value, onChange }: IntervalChipsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {PRESETS.map((p) => (
        <Button
          key={p.seconds}
          type="button"
          variant={value === p.seconds ? 'default' : 'outline'}
          size="xs"
          onClick={() => onChange(p.seconds)}
        >
          {p.label}
        </Button>
      ))}
    </div>
  )
}

export function firesPerDay(intervalSeconds: number): number {
  if (intervalSeconds <= 0) return 0
  return Math.round(86_400 / intervalSeconds)
}
