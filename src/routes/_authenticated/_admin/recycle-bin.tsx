import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import type { ColumnDef } from '@tanstack/react-table'
import { RotateCcw, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { DataTable } from '@/components/DataTable'
import { DateTime } from '@/components/DateTime'
import { EmptyState } from '@/components/EmptyState'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { restoreAlertRuleFn } from '@/lib/alert-rules/server-fns'
import { restoreChannelFn } from '@/lib/channels/server-fns'
import { restoreJobFn } from '@/lib/jobs/server-fns'
import type { DeletedItem, DeletedKind } from '@/lib/recycle-bin/queries'
import { listDeletedQueryOptions } from '@/lib/recycle-bin/query-options'
import { purgeDeletedFn } from '@/lib/recycle-bin/server-fns'
import { restoreTargetFn } from '@/lib/targets/server-fns'

const KIND_LABEL: Record<DeletedKind, string> = {
  job: 'Job',
  target: 'Target',
  channel: 'Channel',
  'alert-rule': 'Alert rule',
}

const restoreByKind: Record<DeletedKind, (item: DeletedItem) => Promise<unknown>> = {
  job: (i) => restoreJobFn({ data: { workspaceSlug: i.workspaceSlug, jobSlug: i.slug } }),
  target: (i) => restoreTargetFn({ data: { workspaceSlug: i.workspaceSlug, targetSlug: i.slug } }),
  channel: (i) =>
    restoreChannelFn({ data: { workspaceSlug: i.workspaceSlug, channelSlug: i.slug } }),
  'alert-rule': (i) =>
    restoreAlertRuleFn({ data: { workspaceSlug: i.workspaceSlug, ruleSlug: i.slug } }),
}

export const Route = createFileRoute('/_authenticated/_admin/recycle-bin')({
  loader: ({ context }) => context.queryClient.ensureQueryData(listDeletedQueryOptions()),
  component: RecycleBinPage,
})

function RecycleBinActions({ item }: { item: DeletedItem }) {
  const queryClient = useQueryClient()
  const invalidate = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['recycle-bin'] }),
      queryClient.invalidateQueries({ queryKey: ['jobs'] }),
      queryClient.invalidateQueries({ queryKey: ['tunnels'] }),
      queryClient.invalidateQueries({ queryKey: ['workspaces'] }),
    ])

  const restore = useMutation({
    mutationFn: () => restoreByKind[item.kind](item),
    onSuccess: async () => {
      await invalidate()
      toast.success(`Restored ${item.name}`)
    },
    onError: () => toast.error('Could not restore.'),
  })

  const purge = useMutation({
    mutationFn: () =>
      purgeDeletedFn({
        data: { kind: item.kind, workspaceSlug: item.workspaceSlug, slug: item.slug },
      }),
    onSuccess: async (res) => {
      if (!res.ok) {
        toast.error(res.message)
        return
      }
      await invalidate()
      toast.success(`Deleted ${item.name} permanently`)
    },
    onError: () => toast.error('Could not delete.'),
  })

  const busy = restore.isPending || purge.isPending

  return (
    <div className="flex justify-end gap-1.5">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={busy}
        onClick={() => restore.mutate()}
      >
        <RotateCcw aria-hidden /> Restore
      </Button>
      <AlertDialog>
        <AlertDialogTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy}
              className="text-destructive"
            />
          }
        >
          <Trash2 aria-hidden /> Delete permanently
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {item.name} permanently?</AlertDialogTitle>
            <AlertDialogDescription>
              This can't be undone.
              {item.kind === 'job' ? ' Its run history will be deleted too.' : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => purge.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

const columns: ColumnDef<DeletedItem>[] = [
  {
    id: 'type',
    accessorFn: (row) => KIND_LABEL[row.kind],
    header: 'Type',
    meta: { label: 'Type', filterVariant: 'select' },
    cell: ({ row }) => <Badge variant="secondary">{KIND_LABEL[row.original.kind]}</Badge>,
  },
  {
    accessorKey: 'name',
    header: 'Name',
    cell: ({ row }) => <span className="font-medium text-foreground">{row.original.name}</span>,
  },
  {
    accessorKey: 'workspaceSlug',
    header: 'Workspace',
    cell: ({ row }) => <span className="text-muted-foreground">{row.original.workspaceSlug}</span>,
  },
  {
    accessorKey: 'deletedAt',
    header: 'Deleted',
    cell: ({ row }) => <DateTime value={row.original.deletedAt} />,
  },
  {
    id: 'actions',
    enableHiding: false,
    enableSorting: false,
    cell: ({ row }) => <RecycleBinActions item={row.original} />,
  },
]

function RecycleBinPage() {
  const { data: items } = useSuspenseQuery(listDeletedQueryOptions())

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Recycle Bin</h1>
        <p className="text-sm text-muted-foreground">
          Deleted items. Restore them, or delete permanently.
        </p>
      </header>

      {items.length === 0 ? (
        <EmptyState
          icon={Trash2}
          title="Recycle Bin is empty."
          description="Deleted items show up here. You can restore them or delete them permanently."
        />
      ) : (
        <DataTable columns={columns} data={items} gridKey="recycle-bin" />
      )}
    </div>
  )
}
