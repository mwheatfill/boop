import { queryOptions, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'
import { ArchiveDialog } from '@/components/forms/ArchiveDialog'
import { TargetForm } from '@/components/forms/TargetForm'
import { Button } from '@/components/ui/button'
import {
  archiveTargetFn,
  getTargetFn,
  restoreTargetFn,
  updateTargetFn,
} from '@/lib/targets/server-fns'

const targetQueryOptions = (customerSlug: string, targetSlug: string) =>
  queryOptions({
    queryKey: ['customers', customerSlug, 'targets', targetSlug],
    queryFn: () => getTargetFn({ data: { customerSlug, targetSlug } }),
  })

export const Route = createFileRoute(
  '/_authenticated/_admin/customers/$customerSlug/targets/$targetSlug',
)({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(targetQueryOptions(params.customerSlug, params.targetSlug)),
  component: TargetDetailPage,
})

function TargetDetailPage() {
  const { customerSlug, targetSlug } = Route.useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: target } = useSuspenseQuery(targetQueryOptions(customerSlug, targetSlug))
  const [archiveBlock, setArchiveBlock] = useState<string | null>(null)

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-start justify-between">
        <div className="flex flex-col gap-1">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Target</p>
          <h1 className="text-2xl font-semibold tracking-tight">{target.name}</h1>
          <p className="text-sm text-muted-foreground font-mono">{target.slug}</p>
        </div>
        <div className="flex items-center gap-2">
          {target.status === 'archived' ? (
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                await restoreTargetFn({ data: { customerSlug, targetSlug } })
                await queryClient.invalidateQueries({
                  queryKey: ['customers', customerSlug],
                })
                toast.success(`Restored ${target.name}`)
                await navigate({
                  to: '/customers/$customerSlug',
                  params: { customerSlug },
                })
              }}
            >
              Restore
            </Button>
          ) : (
            <ArchiveDialog
              entityNoun="Target"
              entityName={target.name}
              onArchive={async () => {
                const result = await archiveTargetFn({
                  data: { customerSlug, targetSlug },
                })
                if (!result.ok) {
                  setArchiveBlock(result.message ?? 'Archive blocked.')
                  return
                }
                await queryClient.invalidateQueries({
                  queryKey: ['customers', customerSlug],
                })
                toast.success(`Archived ${target.name}`)
                await navigate({
                  to: '/customers/$customerSlug',
                  params: { customerSlug },
                })
              }}
              blockReason={archiveBlock}
              onOpenChange={(open) => {
                if (!open) setArchiveBlock(null)
              }}
            />
          )}
        </div>
      </header>
      <TargetForm
        variant="edit"
        submitLabel="Save changes"
        initialValues={{
          name: target.name,
          slug: target.slug,
          url: target.url,
          method: target.method,
          authKind: target.authKind,
          authConfig: target.authConfig ?? '',
          reachability: target.reachability,
        }}
        onSubmit={async (value) => {
          const result = await updateTargetFn({
            data: { customerSlug, targetSlug, ...value } as never,
          })
          if (result.ok) {
            await queryClient.invalidateQueries({ queryKey: ['customers', customerSlug] })
            toast.success(`Saved ${result.data.name}`)
          }
          return result
        }}
      />
    </div>
  )
}
