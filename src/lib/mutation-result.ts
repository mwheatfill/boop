import { ArchiveBlockedError, type FieldErrors, FieldValidationError } from '@/lib/errors'

export type MutationResult<T> =
  | { ok: true; data: T }
  | { ok: false; fieldErrors?: FieldErrors; message?: string }

export function asMutationFailure(err: unknown): MutationResult<never> | null {
  if (err instanceof FieldValidationError) {
    return { ok: false, fieldErrors: err.fieldErrors }
  }
  if (err instanceof ArchiveBlockedError) {
    return { ok: false, message: err.message }
  }
  return null
}
