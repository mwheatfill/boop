import { createRouteMask } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'

export const routeMasks = [
  createRouteMask({
    routeTree,
    from: '/customers/$customerSlug/jobs/new',
    to: '/customers/$customerSlug',
    params: (prev) => ({ customerSlug: prev.customerSlug }),
    unmaskOnReload: true,
  }),
  createRouteMask({
    routeTree,
    from: '/customers/$customerSlug/jobs/$jobSlug/edit',
    to: '/customers/$customerSlug/jobs/$jobSlug',
    params: (prev) => ({ customerSlug: prev.customerSlug, jobSlug: prev.jobSlug }),
    unmaskOnReload: true,
  }),
  createRouteMask({
    routeTree,
    from: '/customers/new',
    to: '/customers',
    params: () => ({}),
    unmaskOnReload: true,
  }),
  createRouteMask({
    routeTree,
    from: '/customers/$customerSlug/edit',
    to: '/customers/$customerSlug',
    params: (prev) => ({ customerSlug: prev.customerSlug }),
    unmaskOnReload: true,
  }),
  createRouteMask({
    routeTree,
    from: '/customers/$customerSlug/targets/new',
    to: '/customers/$customerSlug',
    params: (prev) => ({ customerSlug: prev.customerSlug }),
    unmaskOnReload: true,
  }),
  createRouteMask({
    routeTree,
    from: '/customers/$customerSlug/targets/$targetSlug',
    to: '/customers/$customerSlug',
    params: (prev) => ({ customerSlug: prev.customerSlug }),
    unmaskOnReload: true,
  }),
  createRouteMask({
    routeTree,
    from: '/jobs/new',
    to: '/jobs',
    params: () => ({}),
    unmaskOnReload: true,
  }),
]
