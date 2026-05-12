interface UseEntityDefaultOptions<T> {
  urlSourceValue?: T | null | undefined
  lastUsedValue?: T | null | undefined
  fallbackChain?: ReadonlyArray<T | null | undefined>
}

export function useEntityDefault<T>(opts: UseEntityDefaultOptions<T>): T | null {
  if (opts.urlSourceValue) return opts.urlSourceValue
  if (opts.lastUsedValue) return opts.lastUsedValue
  for (const candidate of opts.fallbackChain ?? []) {
    if (candidate) return candidate
  }
  return null
}
