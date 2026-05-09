import { create } from 'zustand'
import type { InstalledPlugin, MarketplaceConfig } from '@/lib/skills/types'

interface SkillsConfigStore {
  marketplaces: MarketplaceConfig[]
  plugins: InstalledPlugin[]
  addMarketplace: (config: MarketplaceConfig) => void
  removeMarketplace: (id: string) => void
  hasMarketplace: (id: string) => boolean
  addPlugin: (plugin: InstalledPlugin) => void
  removePlugin: (id: string) => void
  togglePlugin: (id: string) => void
  hasPlugin: (id: string) => boolean
}

const MARKETPLACE_KEY = 'aegis_skills_marketplaces'
const PLUGIN_KEY = 'aegis_skills_plugins'

function loadMarketplaces(): MarketplaceConfig[] {
  try {
    const raw = localStorage.getItem(MARKETPLACE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    /* noop */
  }
  return []
}

function loadPlugins(): InstalledPlugin[] {
  try {
    const raw = localStorage.getItem(PLUGIN_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    /* noop */
  }
  return []
}

function persistMarketplaces(marketplaces: MarketplaceConfig[]) {
  try {
    localStorage.setItem(MARKETPLACE_KEY, JSON.stringify(marketplaces))
  } catch {
    /* noop */
  }
}

function persistPlugins(plugins: InstalledPlugin[]) {
  try {
    localStorage.setItem(PLUGIN_KEY, JSON.stringify(plugins))
  } catch {
    /* noop */
  }
}

export const useSkillsConfigStore = create<SkillsConfigStore>((set, get) => ({
  marketplaces: loadMarketplaces(),
  plugins: loadPlugins(),

  addMarketplace: (config) => {
    const marketplaces = [...get().marketplaces.filter((m) => m.id !== config.id), config]
    set({ marketplaces })
    persistMarketplaces(marketplaces)
  },

  removeMarketplace: (id) => {
    const marketplaces = get().marketplaces.filter((m) => m.id !== id)
    set({ marketplaces })
    persistMarketplaces(marketplaces)
  },

  hasMarketplace: (id) => get().marketplaces.some((m) => m.id === id),

  addPlugin: (plugin) => {
    const plugins = [...get().plugins.filter((p) => p.id !== plugin.id), plugin]
    set({ plugins })
    persistPlugins(plugins)
  },

  removePlugin: (id) => {
    const plugins = get().plugins.filter((p) => p.id !== id)
    set({ plugins })
    persistPlugins(plugins)
  },

  togglePlugin: (id) => {
    const plugins = get().plugins.map((p) => (p.id === id ? { ...p, enabled: !p.enabled } : p))
    set({ plugins })
    persistPlugins(plugins)
  },

  hasPlugin: (id) => get().plugins.some((p) => p.id === id),
}))
