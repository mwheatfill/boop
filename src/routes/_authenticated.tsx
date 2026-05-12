import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: ({ context, location }) => {
    if (!context.currentUser) {
      throw redirect({
        to: '/login',
        search: { redirect: location.href },
      })
    }
    return { currentUser: context.currentUser }
  },
  component: Outlet,
})
