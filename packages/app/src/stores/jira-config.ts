import { create } from 'zustand'

export interface JiraConnectionConfig {
  baseUrl: string
  email: string
  apiToken: string
}

interface JiraConfigStore {
  config: JiraConnectionConfig | null
  setConfig: (config: JiraConnectionConfig) => void
  clearConfig: () => void
  isConfigured: () => boolean
}

const STORAGE_KEY = 'aegis_jira_config'

function loadFromStorage(): JiraConnectionConfig | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    /* noop */
  }
  return null
}

function persist(config: JiraConnectionConfig | null) {
  try {
    if (config) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  } catch {
    /* noop */
  }
}

export const useJiraConfigStore = create<JiraConfigStore>((set, get) => ({
  config: loadFromStorage(),

  setConfig: (config) => {
    set({ config })
    persist(config)
  },

  clearConfig: () => {
    set({ config: null })
    persist(null)
  },

  isConfigured: () => !!get().config,
}))
