import { infiniteQueryOptions, useInfiniteQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { ContentChrome } from '@/components/ContentChrome'
import { EmptyState } from '@/components/EmptyState'
import {
  RunsFilterChips,
  type RunsFilters as RunsFiltersUI,
} from '@/components/forms/RunsFilterChips'
import { RunsTable } from '@/components/forms/RunsTable'
import { Button } from '@/components/ui/button'
import { RunsSearchSchema } from '@/lib/runs/filter-schema'
import { listAllRunsFn } from '@/lib/runs/server-fns'
import type { RunsListResponse } from '@/shared/schemas/run'

const runsInfiniteOptions = (search: Record<string, unknown>) =>
  infiniteQueryOptions({
    queryKey: ['runs', search],
    queryFn: ({ pageParam }) =>
      listAllRunsFn({
        data: pageParam ? { ...search, cursor: pageParam } : search,
      }),
    initialPageParam: '' as string,
    getNextPageParam: (lastPage: RunsListResponse) => lastPage.nextCursor ?? undefined,
    refetchInterval: 10_000,
    refetchIntervalInBackground: false,
  })

export const Route = createFileRoute('/_authenticated/runs')({
  validateSearch: RunsSearchSchema,
  loaderDeps: ({ search }) => ({ search }),
  loader: ({ context, deps }) =>
    context.queryClient.ensureInfiniteQueryData(
      runsInfiniteOptions(deps.search as unknown as Record<string, unknown>),
    ),
  component: RunsPage,
})

function searchToFilters(search: Record<string, unknown>): RunsFiltersUI {
  const out: RunsFiltersUI = { range: (search.range as RunsFiltersUI['range']) ?? '24h' }
  if (Array.isArray(search.status)) out.status = search.status as string[]
  if (Array.isArray(search.outcome)) out.outcome = search.outcome as string[]
  if (Array.isArray(search.failureKind)) out.failureKind = search.failureKind as string[]
  if (Array.isArray(search.triggerSource)) out.triggerSource = search.triggerSource as string[]
  if (typeof search.from === 'string' && search.from) out.from = search.from
  if (typeof search.to === 'string' && search.to) out.to = search.to
  return out
}

function RunsPage() {
  const search = Route.useSearch()
  const goTo = Route.useNavigate()
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery(
    runsInfiniteOptions(search as unknown as Record<string, unknown>),
  )

  const rows = data?.pages.flatMap((p) => p.rows) ?? []
  const filters = searchToFilters(search as unknown as Record<string, unknown>)

  const onFilterChange = (next: Partial<RunsFiltersUI>) => {
    void goTo({
      search: (prev) =>
        ({
          ...prev,
          ...next,
          cursor: undefined,
        }) as never,
    })
  }

  const hasNonDefaultFilter =
    (filters.status && filters.status.length > 0) ||
    (filters.outcome && filters.outcome.length > 0) ||
    (filters.failureKind && filters.failureKind.length > 0) ||
    (filters.triggerSource && filters.triggerSource.length > 0) ||
    filters.range !== '24h'

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Runs</h1>
          <p className="text-sm text-muted-foreground">Each time a Job ran. Newest first.</p>
        </div>
        <ContentChrome />
      </header>

      <RunsFilterChips filters={filters} onChange={onFilterChange} />

      {rows.length === 0 ? (
        <EmptyState
          title={hasNonDefaultFilter ? 'No Runs match these filters.' : 'No Runs yet.'}
          description={
            hasNonDefaultFilter
              ? 'Adjust filters above or clear them to see more Runs.'
              : 'Once a Job runs, you will see it here.'
          }
        />
      ) : (
        <>
          <RunsTable rows={rows} />
          {hasNextPage ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="self-start"
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
            >
              {isFetchingNextPage ? 'Loading…' : 'Load more'}
            </Button>
          ) : null}
        </>
      )}
    </div>
  )
}
