import { beforeEach, describe, expect, it } from 'vitest';
import { ProviderRegistry } from '../provider-registry';
import type { ChatChunk, ChatParams, LLMProvider, ModelInfo } from '../types';

// ---------------------------------------------------------------------------
// Mock provider
// ---------------------------------------------------------------------------

function createMockProvider(id: string, name?: string): LLMProvider {
  return {
    id,
    name: name ?? id,
    models: [
      {
        id: 'test-model',
        name: 'Test Model',
        contextWindow: 8_000,
        supportsToolUse: false,
      },
    ] as ModelInfo[],
    supportsToolUse: false,
    supportsStreaming: true,
    maxContextWindow: 8_000,
    async *chat(_params: ChatParams): AsyncIterable<ChatChunk> {
      yield { type: 'text', content: 'mock response' };
      yield { type: 'done' };
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ProviderRegistry', () => {
  let registry: ProviderRegistry;

  beforeEach(() => {
    registry = new ProviderRegistry();
  });

  it('registers and retrieves a provider', () => {
    const provider = createMockProvider('test-provider', 'Test Provider');

    registry.register(provider);
    const retrieved = registry.getProvider('test-provider');

    expect(retrieved).toBeDefined();
    expect(retrieved?.id).toBe('test-provider');
    expect(retrieved?.name).toBe('Test Provider');
  });

  it('returns undefined for an unregistered provider', () => {
    expect(registry.getProvider('nonexistent')).toBeUndefined();
  });

  it('lists all registered providers', () => {
    const p1 = createMockProvider('alpha');
    const p2 = createMockProvider('beta');
    const p3 = createMockProvider('gamma');

    registry.register(p1);
    registry.register(p2);
    registry.register(p3);

    const providers = registry.listProviders();
    expect(providers).toHaveLength(3);

    const ids = providers.map((p) => p.id);
    expect(ids).toContain('alpha');
    expect(ids).toContain('beta');
    expect(ids).toContain('gamma');
  });

  it('sets and gets the default provider', () => {
    const p1 = createMockProvider('first');
    const p2 = createMockProvider('second');

    registry.register(p1);
    registry.register(p2);

    // First registered provider is auto-selected as default
    expect(registry.getDefaultProvider()?.id).toBe('first');

    // Explicitly set the default
    registry.setDefaultProvider('second');
    expect(registry.getDefaultProvider()?.id).toBe('second');
  });

  it('auto-selects the first registered provider as default', () => {
    expect(registry.getDefaultProvider()).toBeUndefined();

    registry.register(createMockProvider('auto-default'));
    expect(registry.getDefaultProvider()?.id).toBe('auto-default');
  });

  it('throws when setting default to an unregistered provider', () => {
    expect(() => registry.setDefaultProvider('nonexistent')).toThrow(
      'Provider "nonexistent" is not registered',
    );
  });

  it('replaces an existing provider with the same id', () => {
    const original = createMockProvider('same-id', 'Original');
    const replacement = createMockProvider('same-id', 'Replacement');

    registry.register(original);
    registry.register(replacement);

    const retrieved = registry.getProvider('same-id');
    expect(retrieved?.name).toBe('Replacement');
    expect(registry.listProviders()).toHaveLength(1);
  });

  it('handles unregister and updates default', () => {
    registry.register(createMockProvider('a'));
    registry.register(createMockProvider('b'));

    registry.setDefaultProvider('a');
    registry.unregister('a');

    // Default should fall back to remaining provider
    expect(registry.getDefaultProvider()?.id).toBe('b');
    expect(registry.getProvider('a')).toBeUndefined();
    expect(registry.listProviders()).toHaveLength(1);
  });
});
