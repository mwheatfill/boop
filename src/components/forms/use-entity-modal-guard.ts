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
  const { status, proceed, reset } = useBlocker({
    shouldBlockFn: () => isDirty,
    withResolver: true,
    enableBeforeUnload: isDirty,
  })
  return {
    status,
    proceed: proceed ?? noop,
    reset: reset ?? noop,
  }
}

function noop() {}
