import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/_admin')({
  beforeLoad: ({ context, location }) => {
    if (context.currentUser?.role !== 'admin') {
      throw redirect({
        to: '/',
        search: { unauthorized: location.pathname },
      })
    }
  },
  component: Outlet,
})
