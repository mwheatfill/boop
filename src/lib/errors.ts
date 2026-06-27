export type FieldErrors = Record<string, string[]>

export class FieldValidationError extends Error {
  readonly fieldErrors: FieldErrors

  constructor(fieldErrors: FieldErrors) {
    super('Field validation failed')
    this.name = 'FieldValidationError'
    this.fieldErrors = fieldErrors
  }
}

export type ArchiveBlockedEntityKind = 'workspace' | 'target' | 'channel' | 'tunnel'

function archiveBlockedMessage(entityKind: ArchiveBlockedEntityKind, count: number): string {
  if (entityKind === 'channel') {
    return count === 1
      ? 'This Channel is referenced by 1 active alert rule. Update that rule before archiving this Channel.'
      : `This Channel is referenced by ${count} active alert rules. Update those rules before archiving this Channel.`
  }
  if (entityKind === 'tunnel') {
    return count === 1
      ? 'This Tunnel is used by 1 active Target. Archive that Target before removing this Tunnel.'
      : `This Tunnel is used by ${count} active Targets. Archive those Targets before removing this Tunnel.`
  }
  const noun = entityKind === 'workspace' ? 'Workspace' : 'Target'
  return count === 1
    ? `${noun} has 1 active Job. Archive it first.`
    : `${noun} has ${count} active Jobs. Archive them first.`
}

export class ArchiveBlockedError extends Error {
  readonly blockingCount: number
  readonly entityKind: ArchiveBlockedEntityKind

  constructor(blockingCount: number, entityKind: ArchiveBlockedEntityKind) {
    super(archiveBlockedMessage(entityKind, blockingCount))
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
