// Augments Cloudflare.Env with the provider Cloudflare API token, a Worker
// secret set via `wrangler secret put` (not declared in wrangler.jsonc, so
// `wrangler types` does not emit it outside local dev). See ADR-028.

declare namespace Cloudflare {
  interface Env {
    CF_PROVIDER_API_TOKEN: string
  }
}
