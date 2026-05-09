import { createFileRoute } from '@tanstack/react-router'
import {
  Activity,
  Bot,
  Info,
  Link2,
  Link2Off,
  Moon,
  Palette,
  Plus,
  Settings,
  Sparkles,
  Sun,
  Trash2,
  User,
  Wrench,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { EmptyState } from '@/components/shared/EmptyState'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { initiateAtlassianAuth } from '@/lib/auth/atlassian'
import { getAtlassianConfig, getGitHubConfig, getGoogleConfig, getRedHatConfig } from '@/lib/auth/config'
import { initiateGitHubAuth } from '@/lib/auth/github'
import { initiateGoogleAuth } from '@/lib/auth/google'
import { authManager } from '@/lib/auth/manager'
import { initiateRedHatAuth } from '@/lib/auth/redhat-sso'
import type { AuthProvider, AuthState } from '@/lib/auth/types'
import { providerRegistry } from '@/lib/llm/provider-registry'
import type { LLMProvider } from '@/lib/llm/types'

export const Route = createFileRoute('/settings')({
  component: SettingsPage,
})

const AUTH_PROVIDERS: { id: AuthProvider; label: string; description: string }[] = [
  { id: 'github', label: 'GitHub', description: 'Source control and issue tracking' },
  { id: 'atlassian', label: 'Atlassian', description: 'Jira boards and Confluence docs' },
  { id: 'redhat-sso', label: 'Red Hat SSO', description: 'Enterprise single sign-on (OIDC)' },
  { id: 'google', label: 'Google', description: 'Google Workspace and Vertex AI' },
]

function formatExpiry(expiresAt: number): string {
  const remaining = expiresAt - Date.now()
  if (remaining <= 0) return 'Expired'
  const minutes = Math.floor(remaining / 60_000)
  if (minutes < 60) return `Expires in ${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `Expires in ${hours}h ${minutes % 60}m`
  const days = Math.floor(hours / 24)
  return `Expires in ${days}d`
}

function useAuthState(): AuthState {
  const [state, setState] = useState<AuthState>(() => authManager.getState())

  useEffect(() => {
    const unsubscribe = authManager.onAuthChange((newState) => {
      setState(newState)
    })
    return unsubscribe
  }, [])

  return state
}

import { initJiraClient } from '@/lib/jira/client'
import { mcpManager } from '@/lib/mcp/manager'
import type { MCPConnection } from '@/lib/mcp/types'
import { skillManager } from '@/lib/skills/manager'
import { useJiraConfigStore } from '@/stores/jira-config'
import { type MCPServerConfig, useMCPConfigStore } from '@/stores/mcp-config'
import { PERSONA_DESCRIPTIONS, PERSONA_LABELS, type PersonaRole, usePersonaStore } from '@/stores/persona'
import { useSkillsConfigStore } from '@/stores/skills-config'
import { useTelemetryStore } from '@/stores/telemetry'
import { useThemeStore } from '@/stores/theme'

function useTheme() {
  const isDark = useThemeStore((s) => s.isDark)
  const toggle = useThemeStore((s) => s.toggle)
  return { isDark, toggle }
}

function connectionMethod(providerId: AuthProvider): string {
  switch (providerId) {
    case 'github':
      return 'OAuth'
    case 'atlassian':
      return 'OAuth'
    case 'redhat-sso':
      return 'SSO (OIDC)'
    case 'google':
      return 'OAuth'
    default:
      return 'OAuth'
  }
}

function AtlassianConfigPanel({ onConnected }: { onConnected: () => void }) {
  const { config: jiraConfig, setConfig: setJiraConfig } = useJiraConfigStore()
  const [baseUrl, setBaseUrl] = useState(jiraConfig?.baseUrl ?? '')
  const [email, setEmail] = useState(jiraConfig?.email ?? '')
  const [apiToken, setApiToken] = useState(jiraConfig?.apiToken ?? '')

  const handleTokenSave = useCallback(() => {
    if (!baseUrl.trim() || !email.trim() || !apiToken.trim()) return
    const config = {
      baseUrl: baseUrl.trim().replace(/\/$/, ''),
      email: email.trim(),
      apiToken: apiToken.trim(),
    }
    setJiraConfig(config)
    initJiraClient(config)
    onConnected()
  }, [baseUrl, email, apiToken, setJiraConfig, onConnected])

  return (
    <div className="mt-3 space-y-3 rounded-md border border-border bg-muted/30 p-4">
      <div>
        <p className="mb-2 text-sm font-medium text-foreground">API Token (Recommended)</p>
        <p className="mb-3 text-xs text-muted-foreground">
          No admin approval needed. Create a token at{' '}
          <a
            href="https://id.atlassian.com/manage-profile/security/api-tokens"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline"
          >
            id.atlassian.com
          </a>
        </p>
        <div className="space-y-2">
          <Input
            placeholder="https://your-org.atlassian.net"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            aria-label="Jira instance URL"
            className="text-sm"
          />
          <Input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-label="Email"
            className="text-sm"
          />
          <Input
            type="password"
            placeholder="API token"
            value={apiToken}
            onChange={(e) => setApiToken(e.target.value)}
            aria-label="API token"
            className="text-sm"
          />
          <Button size="sm" onClick={handleTokenSave} disabled={!baseUrl.trim() || !email.trim() || !apiToken.trim()}>
            Connect with API Token
          </Button>
        </div>
      </div>
      <Separator />
      <div>
        <p className="mb-2 text-sm font-medium text-foreground">OAuth</p>
        <p className="mb-2 text-xs text-muted-foreground">
          Requires your Atlassian admin to approve the Aegis OAuth app.
        </p>
        <Button variant="outline" size="sm" onClick={() => initiateAtlassianAuth(getAtlassianConfig())}>
          Connect via OAuth
        </Button>
      </div>
    </div>
  )
}

function AuthConnectionsSection() {
  const authState = useAuthState()
  const jiraConfig = useJiraConfigStore((s) => s.config)
  const clearJiraConfig = useJiraConfigStore((s) => s.clearConfig)
  const [atlassianExpanded, setAtlassianExpanded] = useState(false)

  const handleConnect = useCallback((provider: AuthProvider) => {
    if (provider === 'atlassian') {
      setAtlassianExpanded((v) => !v)
      return
    }
    switch (provider) {
      case 'github':
        initiateGitHubAuth(getGitHubConfig())
        break
      case 'redhat-sso':
        initiateRedHatAuth(getRedHatConfig())
        break
      case 'google':
        initiateGoogleAuth(getGoogleConfig())
        break
    }
  }, [])

  const handleDisconnect = useCallback(
    async (provider: AuthProvider) => {
      if (provider === 'atlassian' && jiraConfig) {
        clearJiraConfig()
      }
      await authManager.disconnect(provider)
    },
    [jiraConfig, clearJiraConfig],
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Link2 className="h-5 w-5" />
          Connections
        </CardTitle>
        <CardDescription>Manage connections to external services.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {AUTH_PROVIDERS.map((provider) => {
          const isOAuthConnected = authManager.isConnected(provider.id)
          const isTokenConnected = provider.id === 'atlassian' && !!jiraConfig
          const isConnected = isOAuthConnected || isTokenConnected
          const token = authState.tokens[provider.id]

          const method = isTokenConnected ? 'API token' : connectionMethod(provider.id)
          const detail = isTokenConnected ? jiraConfig?.baseUrl : token ? formatExpiry(token.expiresAt) : undefined

          return (
            <div key={provider.id}>
              <div className="flex items-center justify-between rounded-lg border border-border p-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`h-2.5 w-2.5 rounded-full ${isConnected ? 'bg-green-500' : 'bg-muted-foreground/40'}`}
                    aria-label={isConnected ? 'Connected' : 'Disconnected'}
                  />
                  <div>
                    <p className="text-sm font-medium text-foreground">{provider.label}</p>
                    <p className="text-xs text-muted-foreground">{provider.description}</p>
                    {isConnected && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Connected via {method}
                        {detail && ` · ${detail}`}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isConnected ? (
                    <Button variant="destructive" size="sm" onClick={() => handleDisconnect(provider.id)}>
                      <Link2Off className="mr-1 h-3.5 w-3.5" />
                      Disconnect
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" onClick={() => handleConnect(provider.id)}>
                      <Link2 className="mr-1 h-3.5 w-3.5" />
                      {provider.id === 'atlassian' ? 'Configure' : 'Connect'}
                    </Button>
                  )}
                </div>
              </div>
              {provider.id === 'atlassian' && atlassianExpanded && !isConnected && (
                <AtlassianConfigPanel onConnected={() => setAtlassianExpanded(false)} />
              )}
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

function MCPServersSection() {
  const { servers, addServer, removeServer, toggleServer } = useMCPConfigStore()
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [authType, setAuthType] = useState<MCPServerConfig['authType']>('none')
  const [authToken, setAuthToken] = useState('')
  const [statuses, setStatuses] = useState<Map<string, MCPConnection>>(mcpManager.getConnectionStatus())

  useEffect(() => {
    const interval = setInterval(() => setStatuses(mcpManager.getConnectionStatus()), 3000)
    return () => clearInterval(interval)
  }, [])

  const handleAdd = useCallback(() => {
    if (!name.trim() || !url.trim()) return
    const id = name.trim().toLowerCase().replace(/\s+/g, '-')
    const server: MCPServerConfig = {
      id,
      name: name.trim(),
      url: url.trim(),
      authType,
      authToken: authType !== 'none' ? authToken.trim() : undefined,
      enabled: true,
      isDefault: false,
    }
    addServer(server)
    mcpManager
      .connect(id)
      .then(() => setStatuses(mcpManager.getConnectionStatus()))
      .catch(() => {})
    setName('')
    setUrl('')
    setAuthType('none')
    setAuthToken('')
    setAdding(false)
  }, [name, url, authType, authToken, addServer])

  const handleToggle = useCallback(
    (server: MCPServerConfig) => {
      toggleServer(server.id)
      if (server.enabled) {
        mcpManager
          .disconnect(server.id)
          .then(() => setStatuses(mcpManager.getConnectionStatus()))
          .catch(() => {})
      } else {
        mcpManager
          .connect(server.id)
          .then(() => setStatuses(mcpManager.getConnectionStatus()))
          .catch(() => {})
      }
    },
    [toggleServer],
  )

  const handleRemove = useCallback(
    (id: string) => {
      mcpManager.disconnect(id).catch(() => {})
      removeServer(id)
      setStatuses(mcpManager.getConnectionStatus())
    },
    [removeServer],
  )

  function statusIndicator(serverId: string) {
    const conn = statuses.get(serverId)
    if (!conn) return 'bg-muted-foreground/40'
    switch (conn.status) {
      case 'connected':
        return 'bg-green-500'
      case 'connecting':
        return 'bg-yellow-500'
      case 'error':
        return 'bg-red-500'
      default:
        return 'bg-muted-foreground/40'
    }
  }

  function statusLabel(serverId: string) {
    const conn = statuses.get(serverId)
    if (!conn) return 'Disconnected'
    switch (conn.status) {
      case 'connected':
        return `Connected · ${conn.tools.length} tool${conn.tools.length !== 1 ? 's' : ''}`
      case 'connecting':
        return 'Connecting...'
      case 'error':
        return conn.error ?? 'Connection error'
      default:
        return 'Disconnected'
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wrench className="h-5 w-5" />
          MCP Servers
        </CardTitle>
        <CardDescription>Connect to external tool servers using the Model Context Protocol.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {servers.length === 0 && !adding && <p className="text-sm text-muted-foreground">No MCP servers configured.</p>}

        {servers.map((server) => (
          <div key={server.id} className="flex items-center justify-between rounded-lg border border-border p-4">
            <div className="flex items-center gap-3">
              <div
                className={`h-2.5 w-2.5 rounded-full ${statusIndicator(server.id)}`}
                aria-label={statusLabel(server.id)}
              />
              <div>
                <p className="text-sm font-medium text-foreground">{server.name}</p>
                <p className="max-w-xs truncate text-xs text-muted-foreground">{server.url}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{statusLabel(server.id)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant={server.enabled ? 'default' : 'outline'} size="sm" onClick={() => handleToggle(server)}>
                {server.enabled ? 'Enabled' : 'Disabled'}
              </Button>
              {!server.isDefault && (
                <Button variant="ghost" size="sm" onClick={() => handleRemove(server.id)} aria-label="Remove server">
                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              )}
            </div>
          </div>
        ))}

        {adding && (
          <div className="space-y-3 rounded-md border border-border bg-muted/30 p-4">
            <Input
              placeholder="Server name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-label="MCP server name"
              className="text-sm"
            />
            <Input
              placeholder="https://mcp-server.example.com/mcp"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              aria-label="MCP server URL"
              className="text-sm"
            />
            <div className="flex gap-2">
              {(['none', 'bearer', 'api-key'] as const).map((t) => (
                <Button
                  key={t}
                  size="sm"
                  variant={authType === t ? 'default' : 'outline'}
                  className="text-xs"
                  onClick={() => setAuthType(t)}
                >
                  {t === 'none' ? 'No Auth' : t === 'bearer' ? 'Bearer' : 'API Key'}
                </Button>
              ))}
            </div>
            {authType !== 'none' && (
              <Input
                type="password"
                placeholder={authType === 'bearer' ? 'Bearer token' : 'API key'}
                value={authToken}
                onChange={(e) => setAuthToken(e.target.value)}
                aria-label="Auth token"
                className="text-sm"
              />
            )}
            <div className="flex gap-2">
              <Button size="sm" onClick={handleAdd} disabled={!name.trim() || !url.trim()}>
                Add Server
              </Button>
              <Button size="sm" variant="outline" onClick={() => setAdding(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {!adding && (
          <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            Add Server
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

function SkillsSection() {
  const { plugins, marketplaces, addPlugin, removePlugin, togglePlugin, addMarketplace, removeMarketplace } =
    useSkillsConfigStore()
  const [addingPlugin, setAddingPlugin] = useState(false)
  const [pluginRepoInput, setPluginRepoInput] = useState('')
  const [addingMarketplace, setAddingMarketplace] = useState(false)
  const [marketplaceName, setMarketplaceName] = useState('')
  const [marketplaceSource, setMarketplaceSource] = useState('')

  const handleAddPlugin = useCallback(() => {
    const trimmed = pluginRepoInput.trim()
    if (!trimmed) return
    const id = trimmed.split('/').pop() ?? trimmed
    addPlugin({ id, name: id, source: trimmed, enabled: true, isDefault: false })
    skillManager.loadPlugin(id).catch(() => {})
    setPluginRepoInput('')
    setAddingPlugin(false)
  }, [pluginRepoInput, addPlugin])

  const handleAddMarketplace = useCallback(() => {
    if (!marketplaceName.trim() || !marketplaceSource.trim()) return
    addMarketplace({ id: marketplaceName.trim(), source: marketplaceSource.trim(), enabled: true })
    setMarketplaceName('')
    setMarketplaceSource('')
    setAddingMarketplace(false)
  }, [marketplaceName, marketplaceSource, addMarketplace])

  const handleRemovePlugin = useCallback(
    (id: string) => {
      skillManager.unloadPlugin(id)
      removePlugin(id)
    },
    [removePlugin],
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5" />
          Skills & Plugins
        </CardTitle>
        <CardDescription>Add skills from git repos or plugin marketplaces.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {plugins.length === 0 && marketplaces.length === 0 && !addingPlugin && !addingMarketplace && (
          <p className="text-sm text-muted-foreground">No plugins or marketplaces configured.</p>
        )}

        {marketplaces.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">Marketplaces</p>
            {marketplaces.map((m) => (
              <div key={m.id} className="mb-1 flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <p className="text-sm font-medium text-foreground">{m.id}</p>
                  <p className="max-w-xs truncate text-xs text-muted-foreground">
                    {typeof m.source === 'string' ? m.source : 'configured'}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeMarketplace(m.id)}
                  aria-label="Remove marketplace"
                >
                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {plugins.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">Installed Plugins</p>
            {plugins.map((p) => (
              <div key={p.id} className="mb-1 flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <p className="text-sm font-medium text-foreground">{p.name}</p>
                  {p.description && <p className="text-xs text-muted-foreground">{p.description}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <Button variant={p.enabled ? 'default' : 'outline'} size="sm" onClick={() => togglePlugin(p.id)}>
                    {p.enabled ? 'Enabled' : 'Disabled'}
                  </Button>
                  {!p.isDefault && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemovePlugin(p.id)}
                      aria-label="Remove plugin"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {addingPlugin && (
          <div className="space-y-2 rounded-md border border-border bg-muted/30 p-4">
            <p className="text-xs font-medium text-foreground">Add Plugin from Git</p>
            <Input
              placeholder="owner/repo or https://github.com/owner/repo"
              value={pluginRepoInput}
              onChange={(e) => setPluginRepoInput(e.target.value)}
              aria-label="Plugin repository"
              className="text-sm"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleAddPlugin} disabled={!pluginRepoInput.trim()}>
                Add
              </Button>
              <Button size="sm" variant="outline" onClick={() => setAddingPlugin(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {addingMarketplace && (
          <div className="space-y-2 rounded-md border border-border bg-muted/30 p-4">
            <p className="text-xs font-medium text-foreground">Add Marketplace</p>
            <Input
              placeholder="Marketplace name"
              value={marketplaceName}
              onChange={(e) => setMarketplaceName(e.target.value)}
              aria-label="Marketplace name"
              className="text-sm"
            />
            <Input
              placeholder="owner/repo or https://github.com/owner/repo"
              value={marketplaceSource}
              onChange={(e) => setMarketplaceSource(e.target.value)}
              aria-label="Marketplace source"
              className="text-sm"
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleAddMarketplace}
                disabled={!marketplaceName.trim() || !marketplaceSource.trim()}
              >
                Add
              </Button>
              <Button size="sm" variant="outline" onClick={() => setAddingMarketplace(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {!addingPlugin && !addingMarketplace && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setAddingPlugin(true)}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              Add Plugin
            </Button>
            <Button variant="outline" size="sm" onClick={() => setAddingMarketplace(true)}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              Add Marketplace
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function LLMProviderSection() {
  const [defaultProvider, setDefaultProvider] = useState<LLMProvider | undefined>(() =>
    providerRegistry.getDefaultProvider(),
  )
  const providers = providerRegistry.listProviders()

  const handleSelectProvider = useCallback((id: string) => {
    providerRegistry.setDefaultProvider(id)
    setDefaultProvider(providerRegistry.getDefaultProvider())
  }, [])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bot className="h-5 w-5" />
          LLM Provider
        </CardTitle>
        <CardDescription>Configure the AI model used for chat assistance.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {defaultProvider ? (
          <div className="rounded-lg border border-border p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">{defaultProvider.name}</p>
                {defaultProvider.models.length > 0 && (
                  <p className="text-xs text-muted-foreground">Model: {defaultProvider.models[0].name}</p>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                {defaultProvider.supportsToolUse && <Badge variant="secondary">Tool Use</Badge>}
                {defaultProvider.supportsStreaming && <Badge variant="secondary">Streaming</Badge>}
              </div>
            </div>
          </div>
        ) : (
          <EmptyState
            variant="info"
            icon={Sparkles}
            title="No AI provider configured"
            description="Register an LLM provider to unlock AI-powered chat, code suggestions, and contextual assistance across Aegis."
          />
        )}

        {providers.length > 1 && (
          <>
            <Separator />
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">Available Providers</p>
              {providers.map((p) => (
                <div key={p.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div>
                    <p className="text-sm text-foreground">{p.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.models.length} model{p.models.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <Button
                    variant={p.id === defaultProvider?.id ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleSelectProvider(p.id)}
                    disabled={p.id === defaultProvider?.id}
                  >
                    {p.id === defaultProvider?.id ? 'Active' : 'Select'}
                  </Button>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

function RoleSection() {
  const { role, setRole } = usePersonaStore()
  const roles = Object.entries(PERSONA_LABELS) as [PersonaRole, string][]

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5" />
          Role
        </CardTitle>
        <CardDescription>Your role determines AI prompts, suggested actions, and dashboard widgets.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {roles.map(([id, label]) => (
          <div key={id} className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <p className="text-sm font-medium text-foreground">{label}</p>
              <p className="text-xs text-muted-foreground">{PERSONA_DESCRIPTIONS[id]}</p>
            </div>
            <Button variant={role === id ? 'default' : 'outline'} size="sm" onClick={() => setRole(id)}>
              {role === id ? 'Active' : 'Select'}
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function AppearanceSection() {
  const { isDark, toggle } = useTheme()

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Palette className="h-5 w-5" />
          Appearance
        </CardTitle>
        <CardDescription>Customize the look and feel of Aegis.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between rounded-lg border border-border p-4">
          <div>
            <p className="text-sm font-medium text-foreground">Theme</p>
            <p className="text-xs text-muted-foreground">Switch between light and dark mode</p>
          </div>
          <Button variant="outline" size="sm" onClick={toggle} aria-label="Toggle theme">
            {isDark ? (
              <>
                <Sun className="mr-1 h-3.5 w-3.5" />
                Light
              </>
            ) : (
              <>
                <Moon className="mr-1 h-3.5 w-3.5" />
                Dark
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function TelemetrySection() {
  const {
    enabled,
    otlpEndpoint,
    exportIntervalMs,
    localStorageEnabled,
    setEnabled,
    setOtlpEndpoint,
    setExportInterval,
    setLocalStorageEnabled,
  } = useTelemetryStore()
  const [endpointInput, setEndpointInput] = useState(otlpEndpoint ?? '')

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Telemetry
        </CardTitle>
        <CardDescription>OpenTelemetry metrics collection and export configuration.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between rounded-lg border border-border p-4">
          <div>
            <p className="text-sm font-medium text-foreground">Enable Metrics</p>
            <p className="text-xs text-muted-foreground">Collect performance and usage metrics</p>
          </div>
          <Button variant={enabled ? 'default' : 'outline'} size="sm" onClick={() => setEnabled(!enabled)}>
            {enabled ? 'Enabled' : 'Disabled'}
          </Button>
        </div>

        <div className="rounded-lg border border-border p-4 space-y-3">
          <div>
            <p className="text-sm font-medium text-foreground">OTLP Endpoint</p>
            <p className="text-xs text-muted-foreground mb-2">Send metrics to an OpenTelemetry collector</p>
            <div className="flex gap-2">
              <Input
                placeholder="https://otel-collector.example.com/v1/metrics"
                value={endpointInput}
                onChange={(e) => setEndpointInput(e.target.value)}
                className="text-sm"
                aria-label="OTLP endpoint URL"
              />
              <Button size="sm" variant="outline" onClick={() => setOtlpEndpoint(endpointInput || null)}>
                Save
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm text-foreground">Export Interval</p>
            <div className="flex gap-1">
              {[15000, 30000, 60000, 300000].map((ms) => (
                <Button
                  key={ms}
                  size="sm"
                  variant={exportIntervalMs === ms ? 'default' : 'outline'}
                  className="text-xs"
                  onClick={() => setExportInterval(ms)}
                >
                  {ms < 60000 ? `${ms / 1000}s` : `${ms / 60000}m`}
                </Button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-border p-4">
          <div>
            <p className="text-sm font-medium text-foreground">Local Metrics Storage</p>
            <p className="text-xs text-muted-foreground">Store metrics in IndexedDB for local analysis</p>
          </div>
          <Button
            variant={localStorageEnabled ? 'default' : 'outline'}
            size="sm"
            onClick={() => setLocalStorageEnabled(!localStorageEnabled)}
          >
            {localStorageEnabled ? 'Enabled' : 'Disabled'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function AboutSection() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Info className="h-5 w-5" />
          About
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm text-foreground">Aegis</p>
          <Badge variant="outline">v0.1.0</Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Zero-infrastructure development platform. Unified kanban board, AI chat, and web IDE — all in your browser.
        </p>
        <Separator />
        <a
          href="https://github.com/tpouyer/aegis/blob/main/docs/design.md"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-primary underline-offset-4 hover:underline"
        >
          View design document
        </a>
      </CardContent>
    </Card>
  )
}

function SettingsPage() {
  useEffect(() => {
    document.title = 'Settings — Aegis'
  }, [])

  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="mb-6 flex items-center gap-3">
        <Settings className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">Settings</h1>
          <p className="text-sm text-muted-foreground">Authentication, LLM provider configuration, and preferences.</p>
        </div>
      </div>

      <Tabs defaultValue="integrations" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
          <TabsTrigger value="preferences">Preferences</TabsTrigger>
          <TabsTrigger value="about">About</TabsTrigger>
        </TabsList>

        <TabsContent value="integrations" className="space-y-6">
          <AuthConnectionsSection />
          <Separator />
          <MCPServersSection />
          <Separator />
          <SkillsSection />
          <Separator />
          <LLMProviderSection />
        </TabsContent>

        <TabsContent value="preferences" className="space-y-6">
          <RoleSection />
          <Separator />
          <AppearanceSection />
          <Separator />
          <TelemetrySection />
        </TabsContent>

        <TabsContent value="about">
          <AboutSection />
        </TabsContent>
      </Tabs>
    </div>
  )
}
