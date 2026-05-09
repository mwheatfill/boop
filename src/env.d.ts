// Augments the wrangler-generated Cloudflare.Env interface with runtime env
// vars loaded from .dev.vars locally and from `wrangler secret put` in deployed
// environments. Keep optional; absence of a var means the corresponding
// feature is disabled.

declare namespace Cloudflare {
  interface Env {
    // Better Auth
    BETTER_AUTH_SECRET?: string
    BETTER_AUTH_URL?: string

    // Social OAuth
    GOOGLE_CLIENT_ID?: string
    GOOGLE_CLIENT_SECRET?: string
    GITHUB_CLIENT_ID?: string
    GITHUB_CLIENT_SECRET?: string
    APPLE_CLIENT_ID?: string
    APPLE_CLIENT_SECRET?: string

    // Microsoft Entra OIDC
    MICROSOFT_CLIENT_ID?: string
    MICROSOFT_CLIENT_SECRET?: string
    MICROSOFT_TENANT_ID?: string

    // AI provider
    AI_PROVIDER?: 'cloudflare-workers-ai' | 'foundry' | 'anthropic' | 'openai'
    FOUNDRY_AI_GATEWAY_URL?: string
    FOUNDRY_API_KEY?: string
    FOUNDRY_API_VERSION?: string
    FOUNDRY_DEPLOYMENT?: string
    ANTHROPIC_API_KEY?: string
    OPENAI_API_KEY?: string

    // Email transport
    EMAIL_TRANSPORT?: 'resend' | 'graph' | 'cloudflare-email'
    RESEND_API_KEY?: string
    GRAPH_TENANT_ID?: string
    GRAPH_CLIENT_ID?: string
    GRAPH_CLIENT_SECRET?: string
    GRAPH_SHARED_MAILBOX?: string
  }
}
