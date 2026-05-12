import { useEffect, useState } from 'react'

export function SearchHint() {
  const [glyph, setGlyph] = useState<'⌘K' | 'Ctrl K'>('⌘K')
  useEffect(() => {
    if (typeof navigator === 'undefined') return
    if (!navigator.platform.includes('Mac')) setGlyph('Ctrl K')
  }, [])
  return (
    <span
      role="status"
      aria-label="Press the command palette shortcut to search"
      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/30 px-2 py-1 text-xs text-muted-foreground"
    >
      <kbd className="font-mono">{glyph}</kbd>
      <span>to search</span>
    </span>
  )
}
