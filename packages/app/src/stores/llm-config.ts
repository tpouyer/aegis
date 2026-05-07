import { create } from 'zustand'

export interface LLMProviderConfig {
  id: string
  apiKey?: string
  endpoint?: string
  model?: string
  gcpProject?: string
  gcpRegion?: string
}

interface LLMConfigStore {
  providers: LLMProviderConfig[]
  defaultProviderId: string | null
  addProvider: (config: LLMProviderConfig) => void
  removeProvider: (id: string) => void
  setDefault: (id: string) => void
}

const STORAGE_KEY = 'aegis_llm_providers'

function loadFromStorage(): { providers: LLMProviderConfig[]; defaultProviderId: string | null } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    /* noop */
  }
  return { providers: [], defaultProviderId: null }
}

function persist(state: { providers: LLMProviderConfig[]; defaultProviderId: string | null }) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    /* noop */
  }
}

export const useLLMConfigStore = create<LLMConfigStore>((set, get) => {
  const initial = loadFromStorage()
  return {
    ...initial,

    addProvider: (config) => {
      const { providers } = get()
      const filtered = providers.filter((p) => p.id !== config.id)
      const updated = [...filtered, config]
      const state = { providers: updated, defaultProviderId: config.id }
      set(state)
      persist(state)
    },

    removeProvider: (id) => {
      const { providers, defaultProviderId } = get()
      const updated = providers.filter((p) => p.id !== id)
      const newDefault = defaultProviderId === id ? (updated[0]?.id ?? null) : defaultProviderId
      const state = { providers: updated, defaultProviderId: newDefault }
      set(state)
      persist(state)
    },

    setDefault: (id) => {
      const { providers } = get()
      const state = { providers, defaultProviderId: id }
      set(state)
      persist(state)
    },
  }
})
