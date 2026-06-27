// Augments Cloudflare.Env with the env vars consumed by the
// microsoft-foundry/chat-completion recipe. Auto-picked-up by tsconfig.

declare namespace Cloudflare {
  interface Env {
    AI_PROVIDER?: 'cloudflare-workers-ai' | 'foundry' | 'anthropic' | 'openai'
    FOUNDRY_AI_GATEWAY_URL?: string
    FOUNDRY_API_KEY?: string
    FOUNDRY_API_VERSION?: string
    FOUNDRY_DEPLOYMENT?: string
  }
}
