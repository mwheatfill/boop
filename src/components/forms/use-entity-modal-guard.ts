import { useBlocker } from '@tanstack/react-router'

interface UseEntityModalGuardInput {
  isDirty: boolean
}

interface UseEntityModalGuardResult {
  status: 'idle' | 'blocked'
  proceed: () => void
  reset: () => void
}

export function useEntityModalGuard({
  isDirty,
}: UseEntityModalGuardInput): UseEntityModalGuardResult {
  // withResolver: true guarantees proceed/reset are defined.
  const { status, proceed, reset } = useBlocker({
    shouldBlockFn: () => isDirty,
    withResolver: true,
    enableBeforeUnload: false,
  })
  return { status, proceed: proceed as () => void, reset: reset as () => void }
}
