import { createFileRoute } from '@tanstack/react-router'
import { getCurrentUser } from '@/lib/auth/get-current-user'

export const Route = createFileRoute('/api/me')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const user = await getCurrentUser(request)
        if (!user) {
          return Response.json({ error: 'Unauthenticated' }, { status: 401 })
        }
        return Response.json(user)
      },
    },
  },
})
