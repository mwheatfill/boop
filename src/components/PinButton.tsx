import { Pin, PinOff } from 'lucide-react'
import { useShortcut } from '@/components/keyboard/use-shortcut'
import { Button } from '@/components/ui/button'
import type { PinnedEntity } from '@/lib/pinned/store'
import { usePinned } from '@/lib/pinned/use-pinned'

interface PinButtonProps {
  entity: PinnedEntity
}

export function PinButton({ entity }: PinButtonProps) {
  const { isPinned, togglePin } = usePinned()
  const pinned = isPinned(entity)
  const label = pinned ? 'Unpin' : 'Pin'

  useShortcut('Shift+p', () => togglePin(entity), { description: 'Pin / unpin', section: 'page' })

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={label}
      aria-pressed={pinned}
      onClick={() => togglePin(entity)}
    >
      {pinned ? <PinOff aria-hidden /> : <Pin aria-hidden />}
    </Button>
  )
}
