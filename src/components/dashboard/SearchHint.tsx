import { useKeyboard } from '@/components/keyboard/KeyboardProvider'
import { renderKeyCombo } from '@/lib/keyboard/key-combo'

export function SearchHint() {
  const { setPaletteOpen } = useKeyboard()
  const tokens = renderKeyCombo('$mod+k')
  return (
    <button
      type="button"
      onClick={() => setPaletteOpen(true)}
      aria-label="Open command palette"
      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/30 px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      <kbd className="font-mono">{tokens.join('')}</kbd>
      <span>to search</span>
    </button>
  )
}
