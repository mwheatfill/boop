import { createRouter } from '@tanstack/react-router'
import { DefaultCatchBoundary } from '@/components/DefaultCatchBoundary'
import { NotFound } from '@/components/NotFound'
import type { MyRouterContext } from '@/router-context'
import { routeTree } from './routeTree.gen'

export function getRouter() {
  return createRouter({
    routeTree,
    // The router context is typed via MyRouterContext (see
    // src/router-context.ts). The template ships an empty context;
    // recipes augment MyRouterContext via module declaration merging
    // and pass real values here. Example for an auth recipe:
    //   context: { auth: { user: null } } satisfies MyRouterContext
    context: {} as MyRouterContext,
    defaultPreload: 'intent',
    defaultErrorComponent: DefaultCatchBoundary,
    defaultNotFoundComponent: () => <NotFound />,
    scrollRestoration: true,
  })
}
