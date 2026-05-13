import { useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { renderKeyCombo } from '@/lib/keyboard/key-combo'
import { type ShortcutEntry, type ShortcutSection, useKeyboard } from './KeyboardProvider'

const SECTION_LABEL: Record<ShortcutSection, string> = {
  page: 'On this page',
  navigation: 'Navigation',
  global: 'Global',
  actions: 'Actions',
}

const SECTION_ORDER: ShortcutSection[] = ['page', 'actions', 'navigation', 'global']

export function CheatsheetDialog() {
  const { cheatsheetOpen, setCheatsheetOpen, registry } = useKeyboard()

  const groups = useMemo(() => {
    const bySection = new Map<ShortcutSection, ShortcutEntry[]>()
    for (const entry of registry.values()) {
      if (entry.disabled) continue
      const list = bySection.get(entry.section) ?? []
      list.push(entry)
      bySection.set(entry.section, list)
    }
    return SECTION_ORDER.flatMap((section) => {
      const entries = bySection.get(section) ?? []
      return entries.length > 0 ? [{ section, entries }] : []
    })
  }, [registry])

  return (
    <Dialog open={cheatsheetOpen} onOpenChange={setCheatsheetOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>Active shortcuts for the current page.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          {groups.length === 0 ? (
            <p className="text-sm text-muted-foreground">No shortcuts registered yet.</p>
          ) : (
            groups.map((g) => (
              <section key={g.section} className="flex flex-col gap-1.5">
                <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {SECTION_LABEL[g.section]}
                </h3>
                <ul className="flex flex-col gap-1">
                  {g.entries.map((e) => (
                    <li
                      key={e.key + e.description}
                      className="flex items-center justify-between gap-3 text-sm"
                    >
                      <span>{e.description}</span>
                      <span className="flex items-center gap-1 font-mono text-xs">
                        {renderKeyCombo(e.key).map((token) => (
                          <kbd
                            key={`${e.key}-${token}`}
                            className="rounded-sm border border-border bg-secondary px-1.5 py-0.5"
                          >
                            {token}
                          </kbd>
                        ))}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
