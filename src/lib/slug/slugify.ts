const DEFAULT_MAX_LEN = 64

export function slugify(input: string, maxLen: number = DEFAULT_MAX_LEN): string {
  const normalized = typeof input.normalize === 'function' ? input.normalize('NFKD') : input
  return normalized
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLen)
    .replace(/-+$/g, '')
}
