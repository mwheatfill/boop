export const ID_PREFIXES = [
  'cust',
  'usr',
  'tgt',
  'job',
  'run',
  'att',
  'chn',
  'rul',
  'ses',
  'jtpl',
  'whs',
  'csec',
  'tnl',
] as const

export type IdPrefix = (typeof ID_PREFIXES)[number]

const ALPHABET = '0123456789abcdefghjkmnpqrstvwxyz'
const ID_LENGTH = 26

export function newId(prefix: IdPrefix): string {
  const bytes = new Uint8Array(ID_LENGTH)
  crypto.getRandomValues(bytes)
  let body = ''
  for (const byte of bytes) {
    body += ALPHABET[byte & 0x1f]
  }
  return `${prefix}_${body}`
}
