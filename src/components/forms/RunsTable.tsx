import { Link } from '@tanstack/react-router'
import type { ColumnDef } from '@tanstack/react-table'
import { DataTable } from '@/components/DataTable'
import { Badge } from '@/components/ui/badge'
import type { RunSummaryRow } from '@/shared/schemas/run'

const outcomeVariant: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  success: 'default',
  failure: 'destructive',
  timeout: 'destructive',
  skipped: 'secondary',
  running: 'default',
  scheduled: 'outline',
}

function formatDuration(ms: number | null): string {
  if (ms === null) return '—'
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

export function runsColumns(): ColumnDef<RunSummaryRow>[] {
  return [
    {
      accessorKey: 'customerName',
      header: 'Customer',
      cell: ({ row }) => (
        <Link
          to="/customers/$customerSlug"
          params={{ customerSlug: row.original.customerSlug }}
          className="text-sm hover:underline"
        >
          {row.original.customerName}
        </Link>
      ),
    },
    {
      accessorKey: 'jobName',
      header: 'Job',
      cell: ({ row }) => (
        <Link
          to="/customers/$customerSlug/jobs/$jobSlug"
          params={{
            customerSlug: row.original.customerSlug,
            jobSlug: row.original.jobSlug,
          }}
          className="font-medium text-foreground hover:underline"
        >
          {row.original.jobName}
        </Link>
      ),
    },
    {
      accessorKey: 'startedAt',
      header: 'Started',
      cell: ({ row }) =>
        row.original.startedAt ? new Date(row.original.startedAt).toLocaleString() : '—',
    },
    {
      accessorKey: 'durationMs',
      header: 'Duration',
      cell: ({ row }) => formatDuration(row.original.durationMs),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => row.original.status,
    },
    {
      accessorKey: 'displayOutcome',
      header: 'Outcome',
      cell: ({ row }) => (
        <Badge variant={outcomeVariant[row.original.displayOutcome]}>
          {row.original.displayOutcome}
        </Badge>
      ),
    },
    {
      accessorKey: 'triggerSource',
      header: 'Trigger',
      cell: ({ row }) => row.original.triggerSource,
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <Link
          to="/customers/$customerSlug/jobs/$jobSlug/runs/$runId"
          params={{
            customerSlug: row.original.customerSlug,
            jobSlug: row.original.jobSlug,
            runId: row.original.id,
          }}
          className="text-xs hover:underline"
        >
          Open
        </Link>
      ),
    },
  ]
}

interface RunsTableProps {
  rows: RunSummaryRow[]
}

export function RunsTable({ rows }: RunsTableProps) {
  return <DataTable columns={runsColumns()} data={rows} />
}
