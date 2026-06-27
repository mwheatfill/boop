import { queryOptions } from '@tanstack/react-query'
import { getJobTemplateFn, listJobTemplatesFn } from './server-fns'

export const listJobTemplatesQueryOptions = (workspaceSlug?: string, includeArchived = false) =>
  queryOptions({
    queryKey: ['job-templates', { workspaceSlug: workspaceSlug ?? null, includeArchived }],
    queryFn: () =>
      listJobTemplatesFn({
        data: {
          ...(workspaceSlug ? { workspaceSlug } : {}),
          includeArchived,
        },
      }),
    staleTime: 60_000,
  })

export const jobTemplateQueryOptions = (id: string) =>
  queryOptions({
    queryKey: ['job-templates', id],
    queryFn: () => getJobTemplateFn({ data: { id } }),
  })
