import { cloudflare } from '@cloudflare/vite-plugin'
import tailwindcss from '@tailwindcss/vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  server: {
    port: 3000,
  },
  plugins: [
    // tsconfig paths plugin: resolves the `@/*` alias from tsconfig.json
    // for both runtime and build. The earlier template incorrectly used
    // `resolve.tsconfigPaths`, which is not a Vite option; aliases worked
    // only as a side effect of TanStack Start's own resolver. The plugin
    // is the documented Vite-canonical mechanism.
    tsconfigPaths(),
    tailwindcss(),
    // The Cloudflare Vite plugin reads `wrangler.jsonc` and selects the
    // active environment via the `CLOUDFLARE_ENV` env var at build time.
    // Default (unset) uses the top-level config (= dev). For production:
    //   CLOUDFLARE_ENV=production pnpm build
    // The plugin then merges the `env.production` block into
    // dist/server/wrangler.json. See README "Per-environment wrangler
    // config" and ADR-0001 for the full explanation.
    cloudflare({
      viteEnvironment: { name: 'ssr' },
    }),
    tanstackStart(),
    viteReact(),
  ],
  build: {
    chunkSizeWarningLimit: 750,
  },
})
