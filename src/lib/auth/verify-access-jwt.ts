import { createRemoteJWKSet, errors, type JWTPayload, type JWTVerifyGetKey, jwtVerify } from 'jose'
import { AccessJwtError } from './errors'

export interface VerifyAccessJwtDeps {
  jwks?: JWTVerifyGetKey
}

export interface AccessJwtClaims extends JWTPayload {
  email?: string
  name?: string
  picture?: string
}

let cachedJwks: JWTVerifyGetKey | null = null
let cachedJwksDomain: string | null = null

function jwksFor(teamDomain: string): JWTVerifyGetKey {
  if (cachedJwks && cachedJwksDomain === teamDomain) return cachedJwks
  cachedJwks = createRemoteJWKSet(new URL(`${teamDomain}/cdn-cgi/access/certs`))
  cachedJwksDomain = teamDomain
  return cachedJwks
}

export async function verifyAccessJwt(
  token: string,
  env: { TEAM_DOMAIN?: string; POLICY_AUD?: string },
  deps: VerifyAccessJwtDeps = {},
): Promise<AccessJwtClaims> {
  if (!env.TEAM_DOMAIN || !env.POLICY_AUD) {
    throw new AccessJwtError('missing_env', 'TEAM_DOMAIN or POLICY_AUD is not configured')
  }
  if (!token) {
    throw new AccessJwtError('missing_token', 'No Cf-Access-Jwt-Assertion token provided')
  }
  const jwks = deps.jwks ?? jwksFor(env.TEAM_DOMAIN)
  try {
    const { payload } = await jwtVerify(token, jwks, {
      issuer: env.TEAM_DOMAIN,
      audience: env.POLICY_AUD,
    })
    return payload as AccessJwtClaims
  } catch (err) {
    if (err instanceof errors.JWTExpired) {
      throw new AccessJwtError('expired', 'JWT has expired')
    }
    if (err instanceof errors.JWTClaimValidationFailed) {
      const kind = err.claim === 'aud' ? 'audience' : err.claim === 'iss' ? 'issuer' : 'unknown'
      throw new AccessJwtError(kind, err.message)
    }
    if (err instanceof errors.JWSSignatureVerificationFailed) {
      throw new AccessJwtError('signature', 'JWT signature verification failed')
    }
    if (err instanceof errors.JWKSNoMatchingKey || err instanceof errors.JWKSMultipleMatchingKeys) {
      throw new AccessJwtError('jwks_fetch', err.message)
    }
    throw new AccessJwtError('unknown', err instanceof Error ? err.message : String(err))
  }
}
