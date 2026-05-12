import { useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { TargetForm } from '@/components/forms/TargetForm'
import { createTargetFn } from '@/lib/targets/server-fns'

export const Route = createFileRoute('/_authenticated/_admin/customers/$customerSlug/targets/new')({
  component: NewTargetPage,
})

function NewTargetPage() {
  const { customerSlug } = Route.useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">New Target</h1>
      <TargetForm
        variant="create"
        submitLabel="Create Target"
        initialValues={{
          name: '',
          slug: '',
          url: '',
          method: 'POST',
          authKind: 'none',
          authConfig: '',
          reachability: 'public',
        }}
        mutate={(value) => createTargetFn({ data: { customerSlug, ...value } as never })}
        onSuccess={async (target) => {
          await queryClient.invalidateQueries({ queryKey: ['customers', customerSlug] })
          toast.success(`Target ${target.name} created`)
          await navigate({
            to: '/customers/$customerSlug/targets/$targetSlug',
            params: { customerSlug, targetSlug: target.slug },
          })
        }}
      />
    </div>
  )
}
