import { env } from 'cloudflare:workers'
import { createAzure } from '@ai-sdk/azure'

export type AIClient = ReturnType<typeof createAzure>

// This file is owned by the microsoft-foundry/chat-completion recipe.
// Switching to a different AI provider replaces this file with that
// provider's implementation (cloudflare-workers-ai/setup,
// anthropic/chat-completion, openai/chat-completion).

export function getAIClient(): AIClient {
  if (env.AI_PROVIDER !== 'foundry') {
    throw new Error(
      `AI_PROVIDER must be 'foundry' for this client (got '${env.AI_PROVIDER ?? 'unset'}'). ` +
        'Install a different AI provider recipe if you want a different provider.',
    )
  }
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

export function getDefaultModelName(): string {
  if (!env.FOUNDRY_DEPLOYMENT) {
    throw new Error(
      'FOUNDRY_DEPLOYMENT is not set. Set it to your Foundry deployment name in env, ' +
        'or override the model name at the call site.',
    )
  }
  return env.FOUNDRY_DEPLOYMENT
}
