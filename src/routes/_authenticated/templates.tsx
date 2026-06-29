import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { JobSheet } from '@/components/forms/JobSheet'
import { TemplateGallery } from '@/components/templates/TemplateGallery'
import { Button } from '@/components/ui/button'
import { isAdmin } from '@/lib/auth/is-admin'
import { listJobTemplatesQueryOptions } from '@/lib/job-templates/query-options'
import type { JobTemplate } from '@/shared/schemas/job-template'

const templatesOptions = listJobTemplatesQueryOptions(undefined)

export const Route = createFileRoute('/_authenticated/templates')({
  loader: ({ context }) => context.queryClient.ensureQueryData(templatesOptions),
  component: TemplatesRoute,
})

function TemplatesRoute() {
  const { workspaceSlug, currentUser } = Route.useRouteContext()
  const { data: templates } = useSuspenseQuery(templatesOptions)
  const [pendingTemplate, setPendingTemplate] = useState<JobTemplate | null>(null)

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Templates</h1>
          <p className="text-sm text-muted-foreground">
            Starter recipes and saved Job patterns, cloned into regular Jobs when used.
          </p>
        </div>
        <JobSheet
          owner={{ workspaceSlug }}
          isAdmin={isAdmin(currentUser)}
          trigger={
            <Button>
              <Plus aria-hidden /> New Job
            </Button>
          }
        />
      </header>

      <section id="template-gallery">
        <TemplateGallery templates={templates} onSelect={setPendingTemplate} />
      </section>

      {pendingTemplate ? (
        <JobSheet
          key={pendingTemplate.id}
          owner={{ workspaceSlug }}
          isAdmin={isAdmin(currentUser)}
          initialTemplateId={pendingTemplate.id}
          open
          onOpenChange={(open) => {
            if (!open) setPendingTemplate(null)
          }}
        />
      ) : null}
    </div>
  )
}
