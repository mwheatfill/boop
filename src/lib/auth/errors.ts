export type AccessJwtErrorKind =
  | 'missing_env'
  | 'missing_token'
  | 'signature'
  | 'expired'
  | 'audience'
  | 'issuer'
  | 'jwks_fetch'
  | 'unknown'

export class AccessJwtError extends Error {
  readonly kind: AccessJwtErrorKind

  constructor(kind: AccessJwtErrorKind, message: string) {
    super(message)
    this.name = 'AccessJwtError'
    this.kind = kind
  }
}
