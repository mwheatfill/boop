const SECRET_BYTES = 32

export function generateSecretValue(): string {
  const bytes = new Uint8Array(SECRET_BYTES)
  crypto.getRandomValues(bytes)
  let out = ''
  for (const byte of bytes) {
    out += byte.toString(16).padStart(2, '0')
  }
  return out
}
