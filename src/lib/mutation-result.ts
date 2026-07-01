import { ArchiveBlockedError, type FieldErrors, FieldValidationError } from '@/lib/errors'
import type { MutationFailure } from '@/shared/schemas/mutation-result'

export type MutationResult<T> = { ok: true; data: T } | MutationFailure

export function asMutationFailure(err: unknown): MutationResult<never> | null {
  if (err instanceof FieldValidationError) {
    return { ok: false, fieldErrors: err.fieldErrors }
  }
  if (err instanceof ArchiveBlockedError) {
    return { ok: false, message: err.message }
  }
  return null
}

export function fieldErrorsToTanstack(
  fieldErrors: FieldErrors | undefined,
): Record<string, string> {
  if (!fieldErrors) return {}
  const out: Record<string, string> = {}
  for (const [key, msgs] of Object.entries(fieldErrors)) {
    if (msgs[0]) out[key] = msgs[0]
  }
  return out
}

export async function runMutation<T>(fn: () => Promise<T>): Promise<MutationResult<T>> {
  try {
    return { ok: true, data: await fn() }
  } catch (err) {
    const failure = asMutationFailure(err)
    if (failure) return failure
    throw err
  }
}
