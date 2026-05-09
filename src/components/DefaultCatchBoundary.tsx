import {
  ErrorComponent,
  type ErrorComponentProps,
  Link,
  rootRouteId,
  useMatch,
  useRouter,
} from '@tanstack/react-router'

export function DefaultCatchBoundary({ error }: ErrorComponentProps) {
  const router = useRouter()
  const isRoot = useMatch({
    strict: false,
    select: (state) => state.id === rootRouteId,
  })

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-6 text-center">
      <ErrorComponent error={error} />
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => router.invalidate()}
          className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Try again
        </button>
        <Link
          to="/"
          className="inline-flex h-9 items-center rounded-md border border-border px-4 text-sm font-medium hover:bg-muted"
          onClick={
            isRoot
              ? undefined
              : (event) => {
                  event.preventDefault()
                  window.history.back()
                }
          }
        >
          {isRoot ? 'Home' : 'Go back'}
        </Link>
      </div>
    </div>
  )
}
