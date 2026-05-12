import { queryOptions, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { JobForm } from '@/components/forms/JobForm'
import { getJobFn, updateJobFn } from '@/lib/jobs/server-fns'
import { listTargetsForCustomerFn } from '@/lib/targets/server-fns'

const jobOptions = (customerSlug: string, jobSlug: string) =>
  queryOptions({
    queryKey: ['customers', customerSlug, 'jobs', jobSlug],
    queryFn: () => getJobFn({ data: { customerSlug, jobSlug } }),
  })

const targetsOptions = (customerSlug: string) =>
  queryOptions({
    queryKey: ['customers', customerSlug, 'targets', { includeArchived: false }],
    queryFn: () => listTargetsForCustomerFn({ data: { customerSlug, includeArchived: false } }),
  })

export const Route = createFileRoute('/_authenticated/customers/$customerSlug/jobs/$jobSlug/edit')({
  loader: async ({ context, params }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(jobOptions(params.customerSlug, params.jobSlug)),
      context.queryClient.ensureQueryData(targetsOptions(params.customerSlug)),
    ])
  },
  component: EditJobPage,
})

function EditJobPage() {
  const { customerSlug, jobSlug } = Route.useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: job } = useSuspenseQuery(jobOptions(customerSlug, jobSlug))
  const { data: targets } = useSuspenseQuery(targetsOptions(customerSlug))

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">{job.customerName}</p>
        <h1 className="text-2xl font-semibold tracking-tight">Edit {job.name}</h1>
      </header>
      <JobForm
        variant="edit"
        submitLabel="Save changes"
        initialValues={{
          name: job.name,
          slug: job.slug,
          targetSlug: job.targetSlug,
          triggerKind: job.triggerKind,
          cronExpression: job.cronExpression ?? '0 9 * * *',
          intervalSeconds: job.intervalSeconds ?? 60,
          triggerTimezone: job.triggerTimezone ?? job.customerTimezone,
          bodyTemplate: job.bodyTemplate,
          headersTemplate: job.headersTemplate,
          maxAttempts: job.maxAttempts,
          overallDeadlineMs: job.overallDeadlineMs,
        }}
        targets={targets.map((t) => ({ slug: t.slug, name: t.name }))}
        customerName={job.customerName}
        customerTimezone={job.customerTimezone}
        mutate={(value) => updateJobFn({ data: { customerSlug, jobSlug, ...value } as never })}
        onSuccess={async (updated) => {
          await queryClient.invalidateQueries({ queryKey: ['customers', customerSlug] })
          await queryClient.invalidateQueries({ queryKey: ['jobs'] })
          toast.success(`Saved ${updated.name}`)
          await navigate({
            to: '/customers/$customerSlug/jobs/$jobSlug',
            params: { customerSlug, jobSlug: updated.slug },
          })
        }}
      />
    </div>
  )
}
