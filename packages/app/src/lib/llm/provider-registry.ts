/**
 * Provider registry — manages available LLM providers and tracks the
 * user's default selection.
 *
 * Usage:
 *   providerRegistry.register(new AnthropicProvider(config));
 *   const provider = providerRegistry.getDefaultProvider();
 */

import type { LLMProvider } from './types';

export class ProviderRegistry {
  private providers = new Map<string, LLMProvider>();
  private defaultProviderId: string | null = null;

  /**
   * Register a provider. If a provider with the same id already exists
   * it is replaced.
   */
  register(provider: LLMProvider): void {
    this.providers.set(provider.id, provider);

    // Auto-select the first registered provider as default
    if (this.defaultProviderId === null) {
      this.defaultProviderId = provider.id;
    }
  }

  /**
   * Remove a previously registered provider.
   */
  unregister(id: string): void {
    this.providers.delete(id);
    if (this.defaultProviderId === id) {
      const first = this.providers.keys().next();
      this.defaultProviderId = first.done ? null : first.value;
    }
  }

  /**
   * Get a provider by id.
   */
  getProvider(id: string): LLMProvider | undefined {
    return this.providers.get(id);
  }

  /**
   * List all registered providers.
   */
  listProviders(): LLMProvider[] {
    return Array.from(this.providers.values());
  }

  /**
   * Get the default provider (if any).
   */
  getDefaultProvider(): LLMProvider | undefined {
    if (!this.defaultProviderId) return undefined;
    return this.providers.get(this.defaultProviderId);
  }

  /**
   * Set the default provider by id. Throws if the id is not registered.
   */
  setDefaultProvider(id: string): void {
    if (!this.providers.has(id)) {
      throw new Error(`Provider "${id}" is not registered`);
    }
    this.defaultProviderId = id;
  }
}

/** Singleton provider registry for the application. */
export const providerRegistry = new ProviderRegistry();
