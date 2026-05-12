import { useCallback } from 'react'
import { toast } from 'sonner'
import { useLocalStorage } from '@/lib/use-local-storage'
import {
  PINNED_LIMIT,
  PINNED_STORAGE_KEY,
  type PinnedEntity,
  parsePins,
  pinKey,
  sortPins,
} from './store'

interface UsePinnedResult {
  pinned: PinnedEntity[]
  isPinned: (entity: Pick<PinnedEntity, 'id' | 'kind'>) => boolean
  togglePin: (entity: PinnedEntity) => void
}

export function usePinned(): UsePinnedResult {
  const [pinned, setPinned] = useLocalStorage<PinnedEntity[]>(PINNED_STORAGE_KEY, [], {
    parse: parsePins,
  })

  const isPinned = useCallback(
    (entity: Pick<PinnedEntity, 'id' | 'kind'>) => {
      const key = pinKey(entity)
      return pinned.some((p) => pinKey(p) === key)
    },
    [pinned],
  )

  const togglePin = useCallback(
    (entity: PinnedEntity) => {
      const key = pinKey(entity)
      setPinned((prev) => {
        const has = prev.some((p) => pinKey(p) === key)
        if (has) {
          toast.success('Unpinned')
          return prev.filter((p) => pinKey(p) !== key)
        }
        if (prev.length >= PINNED_LIMIT) {
          toast.error('Pin limit reached. Unpin one first.')
          return prev
        }
        toast.success('Pinned')
        return sortPins([...prev, entity])
      })
    },
    [setPinned],
  )

  return { pinned, isPinned, togglePin }
}
