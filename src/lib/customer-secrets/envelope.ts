const ALGORITHM = 'AES-GCM'
const IV_BYTES = 12

function base64Decode(input: string): Uint8Array<ArrayBuffer> {
  const bin = atob(input)
  const out = new Uint8Array(new ArrayBuffer(bin.length))
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function base64Encode(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s)
}

const kekCache = new Map<string, Promise<CryptoKey>>()

function importKek(kekB64: string): Promise<CryptoKey> {
  const cached = kekCache.get(kekB64)
  if (cached) return cached
  const raw = base64Decode(kekB64)
  if (raw.length !== 32) {
    throw new Error(`KEK must decode to 32 bytes (AES-256), got ${raw.length}`)
  }
  const promise = crypto.subtle.importKey('raw', raw, { name: ALGORITHM }, false, [
    'encrypt',
    'decrypt',
  ])
  kekCache.set(kekB64, promise)
  return promise
}

export interface EncryptedSecret {
  ciphertext: string
  iv: string
}

export async function encryptSecret(plaintext: string, kekB64: string): Promise<EncryptedSecret> {
  const key = await importKek(kekB64)
  const iv = new Uint8Array(new ArrayBuffer(IV_BYTES))
  crypto.getRandomValues(iv)
  const buf = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    new TextEncoder().encode(plaintext),
  )
  return { ciphertext: base64Encode(new Uint8Array(buf)), iv: base64Encode(iv) }
}

export async function decryptSecret(
  ciphertextB64: string,
  ivB64: string,
  kekB64: string,
): Promise<string> {
  const key = await importKek(kekB64)
  const iv = base64Decode(ivB64)
  const buf = await crypto.subtle.decrypt({ name: ALGORITHM, iv }, key, base64Decode(ciphertextB64))
  return new TextDecoder().decode(buf)
}

export async function hashSecretValue(plaintext: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(plaintext))
  return base64Encode(new Uint8Array(digest))
}

export function generateKekBase64(): string {
  const raw = new Uint8Array(32)
  crypto.getRandomValues(raw)
  return base64Encode(raw)
}
