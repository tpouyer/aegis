import { create } from 'zustand'

export interface MCPServerConfig {
  id: string
  name: string
  url: string
  authType: 'none' | 'bearer' | 'api-key'
  authToken?: string
  authProvider?: string
  enabled: boolean
  isDefault: boolean
}

interface MCPConfigStore {
  servers: MCPServerConfig[]
  addServer: (server: MCPServerConfig) => void
  updateServer: (id: string, updates: Partial<MCPServerConfig>) => void
  removeServer: (id: string) => void
  toggleServer: (id: string) => void
  hasServer: (id: string) => boolean
}

const STORAGE_KEY = 'aegis_mcp_servers'

function loadFromStorage(): MCPServerConfig[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    /* noop */
  }
  return []
}

function persist(servers: MCPServerConfig[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(servers))
  } catch {
    /* noop */
  }
}

export const useMCPConfigStore = create<MCPConfigStore>((set, get) => ({
  servers: loadFromStorage(),

  addServer: (server) => {
    const servers = [...get().servers.filter((s) => s.id !== server.id), server]
    set({ servers })
    persist(servers)
  },

  updateServer: (id, updates) => {
    const servers = get().servers.map((s) => (s.id === id ? { ...s, ...updates } : s))
    set({ servers })
    persist(servers)
  },

  removeServer: (id) => {
    const servers = get().servers.filter((s) => s.id !== id)
    set({ servers })
    persist(servers)
  },

  toggleServer: (id) => {
    const servers = get().servers.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s))
    set({ servers })
    persist(servers)
  },

  hasServer: (id) => get().servers.some((s) => s.id === id),
}))
