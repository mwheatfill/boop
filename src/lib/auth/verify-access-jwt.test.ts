import { generateKeyPair, type JWTVerifyGetKey, SignJWT } from 'jose'
import { beforeAll, describe, expect, it } from 'vitest'
import { AccessJwtError } from './errors'
import { verifyAccessJwt } from './verify-access-jwt'

const TEAM_DOMAIN = 'https://test.cloudflareaccess.com'
const POLICY_AUD = 'test-aud-tag'

let primaryPrivateKey: CryptoKey
let primaryJwks: JWTVerifyGetKey
let secondaryJwks: JWTVerifyGetKey

beforeAll(async () => {
  const primary = await generateKeyPair('RS256')
  const secondary = await generateKeyPair('RS256')
  primaryPrivateKey = primary.privateKey
  primaryJwks = () => primary.publicKey
  secondaryJwks = () => secondary.publicKey
})

function sign(claims: Record<string, unknown>) {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuedAt()
    .setIssuer(TEAM_DOMAIN)
    .setAudience(POLICY_AUD)
    .setExpirationTime('1h')
    .sign(primaryPrivateKey)
}

describe('verifyAccessJwt', () => {
  it('accepts a valid token signed with the expected issuer and audience', async () => {
    const token = await sign({ email: 'a@x.com', name: 'Alex' })
    const claims = await verifyAccessJwt(token, { TEAM_DOMAIN, POLICY_AUD }, { jwks: primaryJwks })
    expect(claims.email).toBe('a@x.com')
    expect(claims.name).toBe('Alex')
  })

  it('rejects an expired token', async () => {
    const now = Math.floor(Date.now() / 1000)
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'RS256' })
      .setIssuedAt(now - 7200)
      .setIssuer(TEAM_DOMAIN)
      .setAudience(POLICY_AUD)
      .setExpirationTime(now - 3600)
      .sign(primaryPrivateKey)
    await expect(
      verifyAccessJwt(token, { TEAM_DOMAIN, POLICY_AUD }, { jwks: primaryJwks }),
    ).rejects.toMatchObject({ kind: 'expired' })
  })

  it('rejects a token with the wrong audience', async () => {
    const token = await sign({})
    await expect(
      verifyAccessJwt(token, { TEAM_DOMAIN, POLICY_AUD: 'different-aud' }, { jwks: primaryJwks }),
    ).rejects.toMatchObject({ kind: 'audience' })
  })

  it('rejects a token with the wrong issuer', async () => {
    const token = await sign({})
    await expect(
      verifyAccessJwt(
        token,
        { TEAM_DOMAIN: 'https://other.cloudflareaccess.com', POLICY_AUD },
        { jwks: primaryJwks },
      ),
    ).rejects.toMatchObject({ kind: 'issuer' })
  })

  it('rejects a token signed by a different keypair', async () => {
    const token = await sign({})
    await expect(
      verifyAccessJwt(token, { TEAM_DOMAIN, POLICY_AUD }, { jwks: secondaryJwks }),
    ).rejects.toMatchObject({ kind: 'signature' })
  })

  it.each([
    { TEAM_DOMAIN: '', POLICY_AUD: 'aud' },
    { TEAM_DOMAIN: 'team', POLICY_AUD: '' },
  ])('throws missing_env when configuration is incomplete', async (env) => {
    const token = await sign({})
    await expect(verifyAccessJwt(token, env, { jwks: primaryJwks })).rejects.toMatchObject({
      kind: 'missing_env',
    })
  })

  it('throws missing_token when the token string is empty', async () => {
    await expect(
      verifyAccessJwt('', { TEAM_DOMAIN, POLICY_AUD }, { jwks: primaryJwks }),
    ).rejects.toMatchObject({ kind: 'missing_token' })
  })

  it('returned errors are AccessJwtError instances', async () => {
    await expect(
      verifyAccessJwt('', { TEAM_DOMAIN, POLICY_AUD }, { jwks: primaryJwks }),
    ).rejects.toBeInstanceOf(AccessJwtError)
  })
})
