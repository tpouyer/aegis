export interface PluginManifest {
  name: string
  description?: string
  version?: string
  skills?: string | string[]
  mcpServers?: Record<string, { command: string; args?: string[] }>
}

export interface MarketplaceCatalog {
  name: string
  owner: { name: string; email?: string }
  description?: string
  plugins: MarketplacePluginEntry[]
  metadata?: { pluginRoot?: string }
}

export interface MarketplacePluginEntry {
  name: string
  source: string | PluginSource
  description?: string
  version?: string
  skills?: string | string[]
}

export type PluginSource =
  | { source: 'github'; repo: string; ref?: string }
  | { source: 'url'; url: string; ref?: string }
  | { source: 'git-subdir'; url: string; path: string; ref?: string }

export interface SkillMetadata {
  id: string
  name: string
  pluginName: string
  description: string
}

export interface SkillFileInfo {
  path: string
  size?: number
}

export interface MarketplaceConfig {
  id: string
  source: PluginSource | string
  enabled: boolean
}

export interface InstalledPlugin {
  id: string
  name: string
  marketplaceId?: string
  source: PluginSource | string
  description?: string
  version?: string
  enabled: boolean
  isDefault: boolean
}
