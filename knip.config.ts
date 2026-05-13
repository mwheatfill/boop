import type { KnipConfig } from 'knip'

const config: KnipConfig = {
  $schema: 'https://unpkg.com/knip@6/schema.json',
  entry: [
    'src/router.tsx',
    'src/router-context.ts',
    'src/route-masks.ts',
    'src/routes/**/*.{ts,tsx}',
    'src/routeTree.gen.ts',
    // Public surfaces: shadcn UI primitives, shared schemas (OpenAPI
    // contract), and per-module lib facades (server-fns / query-options
    // / queries) are intentional API. Their unused exports are not dead
    // code; the actual call sites live in routes knip already traverses.
    'src/components/ui/**/*.tsx',
    'src/shared/schemas/**/*.ts',
    'src/lib/**/server-fns.ts',
    'src/lib/**/query-options.ts',
    'src/lib/**/queries.ts',
    'scripts/**/*.ts',
    '!scripts/**/*.test.ts',
  ],
  project: ['src/**/*.{ts,tsx}', 'scripts/**/*.ts', '!**/*.gen.ts'],
  ignoreExportsUsedInFile: true,
  ignoreDependencies: [
    // Loaded via @tailwindcss/vite, not statically imported.
    'tailwindcss',
    // Imported via the `cloudflare:workers` virtual specifier; not a real npm package.
    'cloudflare',
  ],
}

export default config
