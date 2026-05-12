const encoder = new TextEncoder()

function toHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let out = ''
  for (const byte of bytes) {
    out += byte.toString(16).padStart(2, '0')
  }
  return out
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  )
}

export interface SignWebhookInput {
  secret: string
  timestamp: number
  body: string
}

export async function signWebhook({ secret, timestamp, body }: SignWebhookInput): Promise<string> {
  const key = await importHmacKey(secret)
  const payload = encoder.encode(`${timestamp}.${body}`)
  const signature = await crypto.subtle.sign('HMAC', key, payload)
  return `t=${timestamp},v1=${toHex(signature)}`
}
