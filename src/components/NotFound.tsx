import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'

export function NotFound({ children }: { children?: ReactNode }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="text-2xl font-semibold">Page not found</p>
      <p className="text-muted-foreground">
        {children ?? "The page you're looking for doesn't exist."}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button variant="outline" onClick={() => window.history.back()}>
          Go back
        </Button>
        <Button asChild>
          <Link to="/">Home</Link>
        </Button>
      </div>
    </div>
  )
}
