import { createHash } from 'node:crypto'
import type { IdPrefix } from '@/lib/db/ids'

const ALPHABET = '0123456789abcdefghjkmnpqrstvwxyz'
const ID_LENGTH = 26

export function demoId(prefix: IdPrefix, ...segments: string[]): string {
  const seed = ['boop:demo', prefix, ...segments].join(':')
  const digest = createHash('sha256').update(seed).digest()
  let body = ''
  for (let i = 0; i < ID_LENGTH; i++) {
    const byte = digest[i % digest.length] ?? 0
    body += ALPHABET[byte & 0x1f]
  }
  return `${prefix}_${body}`
}
