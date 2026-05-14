import { Monitor, Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  return (
    <ToggleGroup
      variant="outline"
      size="sm"
      value={mounted && theme ? [theme] : []}
      onValueChange={(v) => v[0] && setTheme(v[0])}
      aria-label="Theme"
    >
      <ToggleGroupItem value="light" aria-label="Light">
        <Sun aria-hidden />
      </ToggleGroupItem>
      <ToggleGroupItem value="dark" aria-label="Dark">
        <Moon aria-hidden />
      </ToggleGroupItem>
      <ToggleGroupItem value="system" aria-label="System">
        <Monitor aria-hidden />
      </ToggleGroupItem>
    </ToggleGroup>
  )
}
