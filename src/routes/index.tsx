import { queryOptions, useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { useEffect } from 'react'
import { toast } from 'sonner'
import { z } from 'zod'
import { EmptyState } from '@/components/EmptyState'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { countCustomersFn } from '@/lib/customers/server-fns'

const customerCountQueryOptions = queryOptions({
  queryKey: ['customers', 'count'],
  queryFn: () => countCustomersFn(),
})

export const Route = createFileRoute('/')({
  validateSearch: z.object({
    unauthorized: z.string().optional(),
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(customerCountQueryOptions),
  component: HomePage,
})

function HomePage() {
  const { data: customerCount } = useSuspenseQuery(customerCountQueryOptions)
  const { unauthorized } = Route.useSearch()

  useEffect(() => {
    if (unauthorized) {
      toast.error('You do not have access to that page.', {
        description: `${unauthorized} requires Admin access.`,
      })
    }
  }, [unauthorized])

  if (customerCount === 0) {
    return (
      <EmptyState
        title="Welcome to boop."
        description="Create your first Customer to get started."
        action={
          <Button render={<Link to="/customers/new" />}>
            <Plus aria-hidden /> New Customer
          </Button>
        }
      />
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">Jobs</h1>
        <p className="max-w-2xl text-muted-foreground">
          The flat Jobs view across all Customers ships in slice 2. For now, navigate Customers to
          manage Targets.
        </p>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <Link to="/customers" className="block">
          <Card className="h-full transition-colors hover:bg-muted">
            <CardHeader>
              <CardTitle className="text-sm">Customers</CardTitle>
              <CardDescription>
                {customerCount === 1 ? '1 Customer' : `${customerCount} Customers`} configured.
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </section>
    </div>
  )
}
