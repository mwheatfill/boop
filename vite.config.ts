import { existsSync } from 'node:fs'
import { cloudflare } from '@cloudflare/vite-plugin'
import tailwindcss from '@tailwindcss/vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const wranglerConfigPath = process.env.WRANGLER_CONFIG ?? 'wrangler.jsonc'
if (!existsSync(wranglerConfigPath)) {
  throw new Error(
    `WRANGLER_CONFIG points at ${wranglerConfigPath} but the file does not exist. ` +
      `Set WRANGLER_CONFIG to a valid path or unset it to use wrangler.jsonc.`,
  )
}

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
      // produce a production-flavored bundle. See README "Per-environment
      // wrangler configs" for the full mechanism.
      configPath: wranglerConfigPath,
    }),
    tanstackStart(),
    viteReact(),
  ],
  build: {
    chunkSizeWarningLimit: 750,
  },
})
