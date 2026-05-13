const encoder = new TextEncoder()

export type VerifyReason = 'missing_header' | 'bad_format' | 'timestamp_skew' | 'no_match'

export type VerifyResult = { valid: true } | { valid: false; reason: VerifyReason }

function fromHex(hex: string): Uint8Array<ArrayBuffer> | null {
  if (hex.length === 0 || hex.length % 2 !== 0) return null
  const bytes = new Uint8Array(new ArrayBuffer(hex.length / 2))
  for (let i = 0; i < bytes.length; i++) {
    const byte = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16)
    if (Number.isNaN(byte)) return null
    bytes[i] = byte
  }
  return bytes
}

interface ParsedHeader {
  timestamp: number
  signature: Uint8Array<ArrayBuffer>
}

function parseHeader(header: string): ParsedHeader | null {
  let timestamp: number | null = null
  let signature: Uint8Array<ArrayBuffer> | null = null
  for (const part of header.split(',')) {
    const [rawKey, rawValue] = part.split('=', 2)
    if (!rawKey || rawValue === undefined) return null
    const key = rawKey.trim()
    const value = rawValue.trim()
    if (key === 't') {
      const parsed = Number.parseInt(value, 10)
      if (!Number.isFinite(parsed) || parsed <= 0) return null
      timestamp = parsed
    } else if (key === 'v1') {
      const decoded = fromHex(value)
      if (!decoded) return null
      signature = decoded
    }
  }
  if (timestamp === null || signature === null) return null
  return { timestamp, signature }
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

export interface VerifyWebhookInput {
  secrets: string[]
  header: string | null
  body: string
  now: number
  toleranceSec?: number
}

const DEFAULT_TOLERANCE_SEC = 300

export async function verifyWebhook({
  secrets,
  header,
  body,
  now,
  toleranceSec = DEFAULT_TOLERANCE_SEC,
}: VerifyWebhookInput): Promise<VerifyResult> {
  if (!header) return { valid: false, reason: 'missing_header' }
  const parsed = parseHeader(header)
  if (!parsed) return { valid: false, reason: 'bad_format' }
  if (Math.abs(now - parsed.timestamp * 1000) > toleranceSec * 1000) {
    return { valid: false, reason: 'timestamp_skew' }
  }
  if (secrets.length === 0) return { valid: false, reason: 'no_match' }
  const payload = encoder.encode(`${parsed.timestamp}.${body}`)
  const results = await Promise.all(
    secrets.map(async (secret) => {
      const key = await importHmacKey(secret)
      return crypto.subtle.verify('HMAC', key, parsed.signature, payload)
    }),
  )
  if (results.some(Boolean)) return { valid: true }
  return { valid: false, reason: 'no_match' }
}
