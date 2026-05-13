import { describe, expect, it } from 'vitest'
import { decryptSecret, encryptSecret, generateKekBase64, hashSecretValue } from './envelope'

const kek = generateKekBase64()

describe('envelope encryption', () => {
  it('round-trips plaintext through encrypt + decrypt', async () => {
    const plaintext = 'sk_live_super_secret_value_42'
    const { ciphertext, iv } = await encryptSecret(plaintext, kek)
    expect(ciphertext).not.toContain(plaintext)
    const decrypted = await decryptSecret(ciphertext, iv, kek)
    expect(decrypted).toBe(plaintext)
  })

  it('produces a fresh iv per encryption call', async () => {
    const a = await encryptSecret('same', kek)
    const b = await encryptSecret('same', kek)
    expect(a.iv).not.toBe(b.iv)
    expect(a.ciphertext).not.toBe(b.ciphertext)
  })

  it('fails to decrypt with a different KEK', async () => {
    const other = generateKekBase64()
    const { ciphertext, iv } = await encryptSecret('hello', kek)
    await expect(decryptSecret(ciphertext, iv, other)).rejects.toThrow()
  })

  it('fails to decrypt when iv is wrong', async () => {
    const { ciphertext } = await encryptSecret('hello', kek)
    const bogusIv = (await encryptSecret('different', kek)).iv
    await expect(decryptSecret(ciphertext, bogusIv, kek)).rejects.toThrow()
  })

  it('rejects a KEK whose decoded length is not 32 bytes', async () => {
    await expect(encryptSecret('x', btoa('short'))).rejects.toThrow(/32 bytes/)
  })

  it('hashSecretValue is deterministic per plaintext and differs across plaintexts', async () => {
    const a1 = await hashSecretValue('alice')
    const a2 = await hashSecretValue('alice')
    const b = await hashSecretValue('bob')
    expect(a1).toBe(a2)
    expect(a1).not.toBe(b)
  })
})
