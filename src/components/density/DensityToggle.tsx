import { useId } from 'react'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { useDensity } from './DensityProvider'

export function DensityToggle() {
  const { density, setDensity } = useDensity()
  const compactId = useId()
  const spaciousId = useId()
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Density</p>
      <RadioGroup
        value={density}
        onValueChange={(v) => {
          if (v === 'compact' || v === 'spacious') setDensity(v)
        }}
        className="grid grid-cols-1 gap-2"
      >
        <label htmlFor={compactId} className="flex items-center gap-2 text-sm">
          <RadioGroupItem id={compactId} value="compact" />
          <span>Compact</span>
          <span className="ml-auto text-xs text-muted-foreground">Default</span>
        </label>
        <label htmlFor={spaciousId} className="flex items-center gap-2 text-sm">
          <RadioGroupItem id={spaciousId} value="spacious" />
          <span>Spacious</span>
          <span className="ml-auto text-xs text-muted-foreground">+50%</span>
        </label>
      </RadioGroup>
    </div>
  )
}
