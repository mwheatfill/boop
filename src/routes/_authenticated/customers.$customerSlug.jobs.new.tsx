import { queryOptions, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { JobForm } from '@/components/forms/JobForm'
import { getCustomerFn } from '@/lib/customers/server-fns'
import { createJobFn } from '@/lib/jobs/server-fns'
import { listTargetsForCustomerFn } from '@/lib/targets/server-fns'

const customerOptions = (slug: string) =>
  queryOptions({
    queryKey: ['customers', slug],
    queryFn: () => getCustomerFn({ data: { slug } }),
  })

const targetsOptions = (customerSlug: string) =>
  queryOptions({
    queryKey: ['customers', customerSlug, 'targets', { includeArchived: false }],
    queryFn: () => listTargetsForCustomerFn({ data: { customerSlug, includeArchived: false } }),
  })

export const Route = createFileRoute('/_authenticated/customers/$customerSlug/jobs/new')({
  loader: async ({ context, params }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(customerOptions(params.customerSlug)),
      context.queryClient.ensureQueryData(targetsOptions(params.customerSlug)),
    ])
  },
  component: NewJobPage,
})

function NewJobPage() {
  const { customerSlug } = Route.useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: customer } = useSuspenseQuery(customerOptions(customerSlug))
  const { data: targets } = useSuspenseQuery(targetsOptions(customerSlug))

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">{customer.name}</p>
        <h1 className="text-2xl font-semibold tracking-tight">New Job</h1>
      </header>
      {targets.length === 0 ? (
        <p className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm">
          {customer.name} has no Targets. Add a Target first.
        </p>
      ) : (
        <JobForm
          variant="create"
          submitLabel="Create Job"
          initialValues={{
            name: '',
            slug: '',
            targetSlug: targets[0]?.slug ?? '',
            triggerKind: 'cron',
            cronExpression: '0 9 * * *',
            intervalSeconds: 60,
            triggerTimezone: customer.timezone,
            bodyTemplate: '',
            headersTemplate: '{}',
            maxAttempts: 3,
            overallDeadlineMs: 60_000,
          }}
          targets={targets.map((t) => ({ slug: t.slug, name: t.name }))}
          customerName={customer.name}
          customerTimezone={customer.timezone}
          mutate={(value) => createJobFn({ data: { customerSlug, ...value } as never })}
          onSuccess={async (job) => {
            await queryClient.invalidateQueries({ queryKey: ['customers', customerSlug] })
            await queryClient.invalidateQueries({ queryKey: ['jobs'] })
            toast.success(`Job ${job.name} created`)
            await navigate({
              to: '/customers/$customerSlug/jobs/$jobSlug',
              params: { customerSlug, jobSlug: job.slug },
            })
          }}
        />
      )}
    </div>
  )
}
