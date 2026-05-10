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
    cloudflare({
      viteEnvironment: { name: 'ssr' },
      // Per-env wrangler configs. Default is wrangler.jsonc (dev). Set
      // WRANGLER_CONFIG=wrangler.production.jsonc before `pnpm build` to
      // produce a production-flavored bundle.
      configPath: process.env.WRANGLER_CONFIG ?? 'wrangler.jsonc',
    }),
    tanstackStart(),
    viteReact(),
  ],
  build: {
    chunkSizeWarningLimit: 750,
  },
})
