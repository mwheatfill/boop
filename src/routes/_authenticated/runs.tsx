import { infiniteQueryOptions, useInfiniteQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { DateRangeFilter } from '@/components/data-table/data-table-date-filter'
import { FacetedFilter } from '@/components/data-table/data-table-faceted-filter'
import { EmptyState } from '@/components/EmptyState'
import { RunsTable } from '@/components/forms/RunsTable'
import { Button } from '@/components/ui/button'
import { type RunsFilters, RunsSearchSchema, TRIGGER_SOURCES } from '@/lib/runs/filter-schema'
import { listAllRunsFn } from '@/lib/runs/server-fns'
import {
  FAILURE_KINDS,
  RUN_OUTCOMES,
  RUN_STATUSES,
  type RunsListResponse,
} from '@/shared/schemas/run'

const runsInfiniteOptions = (search: RunsFilters) =>
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
    context.queryClient.ensureInfiniteQueryData(runsInfiniteOptions(deps.search)),
  component: RunsPage,
})

function RunsPage() {
  const search = Route.useSearch()
  const goTo = Route.useNavigate()
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery(
    runsInfiniteOptions(search),
  )

  const rows = data?.pages.flatMap((p) => p.rows) ?? []

  const onFilterChange = (next: Record<string, unknown>) => {
    void goTo({ search: (prev) => ({ ...prev, ...next, cursor: undefined }) as never })
  }

  const showFailureKind = (search.outcome ?? []).includes('failure')
  const hasNonDefaultFilter =
    (search.status?.length ?? 0) > 0 ||
    (search.outcome?.length ?? 0) > 0 ||
    (search.failureKind?.length ?? 0) > 0 ||
    (search.triggerSource?.length ?? 0) > 0 ||
    (search.range ?? '24h') !== '24h'

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Runs</h1>
        <p className="text-sm text-muted-foreground">Each time a Job ran. Newest first.</p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <FacetedFilter
          title="Status"
          options={RUN_STATUSES.map((v) => ({ value: v }))}
          value={search.status ?? []}
          onChange={(status) => onFilterChange({ status })}
        />
        <FacetedFilter
          title="Outcome"
          options={RUN_OUTCOMES.map((v) => ({ value: v }))}
          value={search.outcome ?? []}
          onChange={(outcome) => onFilterChange({ outcome })}
        />
        {showFailureKind ? (
          <FacetedFilter
            title="Failure"
            options={FAILURE_KINDS.map((v) => ({ value: v }))}
            value={search.failureKind ?? []}
            onChange={(failureKind) => onFilterChange({ failureKind })}
          />
        ) : null}
        <FacetedFilter
          title="Trigger"
          options={TRIGGER_SOURCES.map((v) => ({ value: v }))}
          value={search.triggerSource ?? []}
          onChange={(triggerSource) => onFilterChange({ triggerSource })}
        />
        <div className="ml-auto">
          <DateRangeFilter
            value={search.range ?? '24h'}
            onChange={(range) => onFilterChange({ range })}
          />
        </div>
      </div>

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
