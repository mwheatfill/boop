import { queryOptions } from '@tanstack/react-query'
import { listTunnelsFn } from './server-fns'

export const tunnelsQueryOptions = queryOptions({
  queryKey: ['tunnels'],
  queryFn: () => listTunnelsFn(),
})
