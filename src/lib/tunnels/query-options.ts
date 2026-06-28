import { queryOptions } from '@tanstack/react-query'
import { getTunnelFn, listTunnelsFn } from './server-fns'

export const tunnelsQueryOptions = queryOptions({
  queryKey: ['tunnels'],
  queryFn: () => listTunnelsFn(),
})

export const tunnelQueryOptions = (slug: string) =>
  queryOptions({
    queryKey: ['tunnels', slug],
    queryFn: () => getTunnelFn({ data: { slug } }),
  })
