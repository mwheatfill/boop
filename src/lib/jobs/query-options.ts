import { queryOptions } from '@tanstack/react-query'
import { getJobFn } from './server-fns'

export const jobQueryOptions = (workspaceSlug: string, jobSlug: string) =>
  queryOptions({
    queryKey: ['workspaces', workspaceSlug, 'jobs', jobSlug],
    queryFn: () => getJobFn({ data: { workspaceSlug, jobSlug } }),
  })
