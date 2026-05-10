import { cloudflare } from '@cloudflare/vite-plugin'
import tailwindcss from '@tailwindcss/vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    port: 3000,
  },
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [
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
