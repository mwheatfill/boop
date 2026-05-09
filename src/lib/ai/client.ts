import { env } from 'cloudflare:workers'
import { createAzure } from '@ai-sdk/azure'

export type AIClient = ReturnType<typeof createAzure>

export function getAIClient(): AIClient {
  switch (env.AI_PROVIDER) {
    case 'foundry': {
      if (!env.FOUNDRY_AI_GATEWAY_URL || !env.FOUNDRY_API_KEY) {
        throw new Error(
          'AI_PROVIDER=foundry requires FOUNDRY_AI_GATEWAY_URL and FOUNDRY_API_KEY in env.',
        )
      }
      return createAzure({
        baseURL: env.FOUNDRY_AI_GATEWAY_URL,
        apiKey: env.FOUNDRY_API_KEY,
        apiVersion: env.FOUNDRY_API_VERSION ?? 'v1',
      })
    }
    case 'cloudflare-workers-ai':
      throw new Error(
        'AI_PROVIDER=cloudflare-workers-ai: install the cloudflare-workers-ai/setup recipe to enable.',
      )
    case 'anthropic':
      throw new Error(
        'AI_PROVIDER=anthropic: install the anthropic/chat-completion recipe to enable.',
      )
    case 'openai':
      throw new Error('AI_PROVIDER=openai: install the openai/chat-completion recipe to enable.')
    default:
      throw new Error(
        'AI_PROVIDER is not set. See .dev.vars.example for options ' +
          '(cloudflare-workers-ai, foundry, anthropic, openai).',
      )
  }
}

export function getDefaultModelName(): string {
  if (!env.FOUNDRY_DEPLOYMENT) {
    throw new Error(
      'FOUNDRY_DEPLOYMENT is not set. Set it to your Foundry deployment name in env, ' +
        'or override the model name at the call site.',
    )
  }
  return env.FOUNDRY_DEPLOYMENT
}
