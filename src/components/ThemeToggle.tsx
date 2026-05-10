// Raw <button> on purpose. Button (src/components/ui/button.tsx) doesn't
// expose an aria-pressed / active variant, and its sizes don't include
// the 7x7 icon shape this toolbar needs. Don't migrate to <Button>; if
// the design changes, fix it here.
import { Monitor, Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'

const themes = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
] as const

export function ThemeToggle() {
  // No useState/useEffect mount-gate. The React-18-era pattern of
  // returning a placeholder until `mounted` was a workaround for noisy
  // hydration warnings; React 19 + next-themes (with `<html
  // suppressHydrationWarning>` in __root.tsx, which next-themes itself
  // requires) handle the discrepancy correctly. The first render uses
  // `theme === undefined`, so no button is marked active until
  // next-themes resolves the stored preference. That's fine: it
  // accurately represents server-rendered UI before the client knows
  // the user's choice, and avoids ~1 frame of placeholder flash.
  const { theme, setTheme } = useTheme()

  return (
    <div
      role="toolbar"
      aria-label="Theme"
      className="inline-flex items-center gap-1 rounded-lg border border-border bg-card p-1 text-card-foreground"
    >
      {themes.map(({ value, label, icon: Icon }) => {
        const active = theme === value
        return (
          <button
            key={value}
            type="button"
            aria-label={label}
            aria-pressed={active}
            onClick={() => setTheme(value)}
            className={cn(
              'inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              active
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            <Icon className="h-4 w-4" />
          </button>
        )
      })}
    </div>
  )
}
