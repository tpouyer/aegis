import { authManager } from '@/lib/auth/manager'
import { useLLMConfigStore } from '@/stores/llm-config'
import { providerRegistry } from './provider-registry'
import { AnthropicProvider } from './providers/anthropic'
import { CustomProvider } from './providers/custom'
import { OllamaProvider } from './providers/ollama'
import { OpenAIProvider } from './providers/openai'
import { VertexProvider } from './providers/vertex'

export function restoreProviders(): void {
  const { providers, defaultProviderId } = useLLMConfigStore.getState()

  for (const config of providers) {
    switch (config.id) {
      case 'anthropic':
        providerRegistry.register(new AnthropicProvider({ apiKey: config.apiKey }))
        break
      case 'openai':
        providerRegistry.register(new OpenAIProvider({ apiKey: config.apiKey }))
        break
      case 'ollama':
        providerRegistry.register(new OllamaProvider({ endpoint: config.endpoint || 'http://localhost:11434' }))
        break
      case 'vertex': {
        const googleToken = authManager.getState().tokens.google
        providerRegistry.register(
          new VertexProvider({
            project: config.gcpProject || '',
            region: config.gcpRegion || 'us-east5',
            accessToken: googleToken?.accessToken || '',
          }),
        )
        break
      }
      case 'custom':
        providerRegistry.register(
          new CustomProvider({
            endpoint: config.endpoint || '',
            model: config.model || 'default',
          }),
        )
        break
    }
  }

  if (defaultProviderId) {
    providerRegistry.setDefaultProvider(defaultProviderId)
  }
}
