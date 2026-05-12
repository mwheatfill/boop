export type FieldErrors = Record<string, string[]>

export class FieldValidationError extends Error {
  readonly fieldErrors: FieldErrors

  constructor(fieldErrors: FieldErrors) {
    super('Field validation failed')
    this.name = 'FieldValidationError'
    this.fieldErrors = fieldErrors
  }
}

export class ArchiveBlockedError extends Error {
  readonly blockingCount: number
  readonly entityKind: 'customer' | 'target'

  constructor(blockingCount: number, entityKind: 'customer' | 'target') {
    const noun = entityKind === 'customer' ? 'Customer' : 'Target'
    super(
      blockingCount === 1
        ? `${noun} has 1 active Job. Archive it first.`
        : `${noun} has ${blockingCount} active Jobs. Archive them first.`,
    )
    this.name = 'ArchiveBlockedError'
    this.blockingCount = blockingCount
    this.entityKind = entityKind
  }
}

export class NotFoundError extends Error {
  readonly noun: string
  readonly identifier: string

  constructor(noun: string, identifier: string) {
    super(`${noun} '${identifier}' not found`)
    this.name = 'NotFoundError'
    this.noun = noun
    this.identifier = identifier
  }
}

const SQLITE_UNIQUE_CONSTRAINT = 'SQLITE_CONSTRAINT_UNIQUE'
const D1_UNIQUE_PATTERN = /UNIQUE constraint failed/i

export function isUniqueConstraintViolation(err: unknown, qualifiedColumn?: string): boolean {
  if (!err || typeof err !== 'object') return false
  const message = String((err as { message?: unknown }).message ?? '')
  const code = String((err as { code?: unknown }).code ?? '')
  const isUnique = code === SQLITE_UNIQUE_CONSTRAINT || D1_UNIQUE_PATTERN.test(message)
  if (!isUnique) return false
  if (!qualifiedColumn) return true
  return message.includes(qualifiedColumn)
}
