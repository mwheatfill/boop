export const PINNED_STORAGE_KEY = 'boop.pins'
export const PINNED_LIMIT = 20

export type PinnedKind = 'workspace' | 'job'

export interface PinnedEntity {
  id: string
  kind: PinnedKind
  label: string
  slug: string
  workspaceSlug?: string
}

export function pinKey(entity: { id: string; kind: PinnedKind }): string {
  return `${entity.kind}:${entity.id}`
}

export function isValidPin(value: unknown): value is PinnedEntity {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  if (typeof v.id !== 'string' || v.id.length === 0) return false
  if (v.kind !== 'workspace' && v.kind !== 'job') return false
  if (typeof v.label !== 'string' || v.label.length === 0) return false
  if (typeof v.slug !== 'string' || v.slug.length === 0) return false
  if (v.workspaceSlug !== undefined && typeof v.workspaceSlug !== 'string') return false
  return true
}

export function parsePins(raw: unknown): PinnedEntity[] | null {
  if (!Array.isArray(raw)) return null
  const filtered = raw.filter(isValidPin)
  return filtered.slice(0, PINNED_LIMIT)
}

export function sortPins(pins: PinnedEntity[]): PinnedEntity[] {
  return pins
    .slice()
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }))
}
