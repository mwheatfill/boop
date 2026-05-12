import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/me')({
  component: MePage,
})

function MePage() {
  const { currentUser } = Route.useRouteContext()
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">Signed in</h1>
      <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2 text-sm">
        <dt className="font-medium text-muted-foreground">Email</dt>
        <dd>{currentUser.email}</dd>
        <dt className="font-medium text-muted-foreground">Role</dt>
        <dd>{currentUser.role}</dd>
        {currentUser.name ? (
          <>
            <dt className="font-medium text-muted-foreground">Name</dt>
            <dd>{currentUser.name}</dd>
          </>
        ) : null}
      </dl>
    </div>
  )
}
