import { createRouteMask } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'

export const routeMasks = [
  createRouteMask({
    routeTree,
    from: '/jobs/new',
    to: '/jobs',
    params: () => ({}),
    unmaskOnReload: true,
  }),
  createRouteMask({
    routeTree,
    from: '/jobs/$jobSlug/edit',
    to: '/jobs/$jobSlug',
    params: (prev) => ({ jobSlug: prev.jobSlug }),
    unmaskOnReload: true,
  }),
  createRouteMask({
    routeTree,
    from: '/targets/new',
    to: '/targets',
    unmaskOnReload: true,
  }),
  createRouteMask({
    routeTree,
    from: '/tunnels/new',
    to: '/tunnels',
    unmaskOnReload: true,
  }),
  createRouteMask({
    routeTree,
    from: '/tunnels/$tunnelSlug',
    to: '/tunnels',
    unmaskOnReload: true,
  }),
  createRouteMask({
    routeTree,
    from: '/targets/$targetSlug',
    to: '/targets',
    unmaskOnReload: true,
  }),
  createRouteMask({
    routeTree,
    from: '/channels/new',
    to: '/channels',
    unmaskOnReload: true,
  }),
  createRouteMask({
    routeTree,
    from: '/channels/$channelSlug/edit',
    to: '/channels/$channelSlug',
    params: (prev) => ({ channelSlug: prev.channelSlug }),
    unmaskOnReload: true,
  }),
  createRouteMask({
    routeTree,
    from: '/alert-rules/new',
    to: '/alert-rules',
    unmaskOnReload: true,
  }),
  createRouteMask({
    routeTree,
    from: '/alert-rules/$ruleSlug/edit',
    to: '/alert-rules/$ruleSlug',
    params: (prev) => ({ ruleSlug: prev.ruleSlug }),
    unmaskOnReload: true,
  }),
]
