import { queryOptions } from '@tanstack/react-query'
import { getTunnelFn, listTunnelsFn } from './server-fns'

export const tunnelKeys = {
  all: () => ['tunnels'] as const,
  detail: (slug: string) => [...tunnelKeys.all(), slug] as const,
  install: (tunnelId: string) => [...tunnelKeys.all(), tunnelId, 'install'] as const,
}

export const tunnelsQueryOptions = queryOptions({
  queryKey: tunnelKeys.all(),
  queryFn: () => listTunnelsFn(),
})

export const tunnelQueryOptions = (slug: string) =>
  queryOptions({
    queryKey: tunnelKeys.detail(slug),
    queryFn: () => getTunnelFn({ data: { slug } }),
  })
