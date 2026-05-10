import {
  ErrorComponent,
  type ErrorComponentProps,
  Link,
  rootRouteId,
  useMatch,
  useRouter,
} from '@tanstack/react-router'
import { Button } from '@/components/ui/button'

export function DefaultCatchBoundary({ error }: ErrorComponentProps) {
  const router = useRouter()
  const isRoot = useMatch({
    strict: false,
    select: (state) => state.id === rootRouteId,
  })

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-6 text-center">
      {import.meta.env.DEV ? (
        <ErrorComponent error={error} />
      ) : (
        <div className="flex flex-col gap-2">
          <p className="font-medium">Something went wrong.</p>
          <p className="text-sm text-muted-foreground">
            Please try again or return to the home page.
          </p>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button onClick={() => router.invalidate()}>Try again</Button>
        <Button
          variant="outline"
          render={
            <Link
              to="/"
              onClick={
                isRoot
                  ? undefined
                  : (event) => {
                      event.preventDefault()
                      window.history.back()
                    }
              }
            />
          }
        >
          {isRoot ? 'Home' : 'Go back'}
        </Button>
      </div>
    </div>
  )
}
