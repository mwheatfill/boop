import { useKeyboard } from './KeyboardProvider'

export function ChordIndicator() {
  const { chordPrefix } = useKeyboard()
  if (!chordPrefix) return null
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed right-4 bottom-4 z-[60] flex items-center gap-1 rounded-md border border-border bg-secondary px-2 py-1 text-xs text-secondary-foreground shadow-md"
    >
      <kbd className="rounded-sm bg-muted px-1 font-mono">{chordPrefix.toUpperCase()}</kbd>
      <span className="text-muted-foreground">then…</span>
    </div>
  )
}
