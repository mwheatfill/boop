import { queryOptions } from '@tanstack/react-query'
import { getJobTemplateFn, listJobTemplatesFn } from './server-fns'

export const jobTemplateKeys = {
  all: () => ['job-templates'] as const,
  list: (opts: { workspaceSlug: string | null; includeArchived: boolean }) =>
    [...jobTemplateKeys.all(), opts] as const,
  detail: (id: string) => [...jobTemplateKeys.all(), id] as const,
}

export const listJobTemplatesQueryOptions = (workspaceSlug?: string, includeArchived = false) =>
  queryOptions({
    queryKey: jobTemplateKeys.list({ workspaceSlug: workspaceSlug ?? null, includeArchived }),
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
    queryKey: jobTemplateKeys.detail(id),
    queryFn: () => getJobTemplateFn({ data: { id } }),
  })
