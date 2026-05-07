import { createFileRoute } from '@tanstack/react-router'
import { Activity, Bot, Info, Link2, Link2Off, Moon, Palette, Settings, Sparkles, Sun, User } from 'lucide-react'
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

import { PERSONA_DESCRIPTIONS, PERSONA_LABELS, type PersonaRole, usePersonaStore } from '@/stores/persona'
import { useTelemetryStore } from '@/stores/telemetry'
import { useThemeStore } from '@/stores/theme'

function useTheme() {
  const isDark = useThemeStore((s) => s.isDark)
  const toggle = useThemeStore((s) => s.toggle)
  return { isDark, toggle }
}

function AuthConnectionsSection() {
  const authState = useAuthState()

  const handleConnect = useCallback((provider: AuthProvider) => {
    switch (provider) {
      case 'github':
        initiateGitHubAuth(getGitHubConfig())
        break
      case 'atlassian':
        initiateAtlassianAuth(getAtlassianConfig())
        break
      case 'redhat-sso':
        initiateRedHatAuth(getRedHatConfig())
        break
      case 'google':
        initiateGoogleAuth(getGoogleConfig())
        break
    }
  }, [])

  const handleDisconnect = useCallback(async (provider: AuthProvider) => {
    await authManager.disconnect(provider)
  }, [])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Link2 className="h-5 w-5" />
          Auth Connections
        </CardTitle>
        <CardDescription>
          Manage your OAuth provider connections. Tokens are stored securely in the Service Worker.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {AUTH_PROVIDERS.map((provider) => {
          const isConnected = authManager.isConnected(provider.id)
          const token = authState.tokens[provider.id]

          return (
            <div key={provider.id} className="flex items-center justify-between rounded-lg border border-border p-4">
              <div className="flex items-center gap-3">
                <div
                  className={`h-2.5 w-2.5 rounded-full ${isConnected ? 'bg-green-500' : 'bg-muted-foreground/40'}`}
                  aria-label={isConnected ? 'Connected' : 'Disconnected'}
                />
                <div>
                  <p className="text-sm font-medium text-foreground">{provider.label}</p>
                  <p className="text-xs text-muted-foreground">{provider.description}</p>
                  {isConnected && token && (
                    <p className="mt-0.5 text-xs text-muted-foreground">{formatExpiry(token.expiresAt)}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={isConnected ? 'default' : 'secondary'}>
                  {isConnected ? 'Connected' : 'Disconnected'}
                </Badge>
                {isConnected ? (
                  <Button variant="destructive" size="sm" onClick={() => handleDisconnect(provider.id)}>
                    <Link2Off className="mr-1 h-3.5 w-3.5" />
                    Disconnect
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => handleConnect(provider.id)}>
                    <Link2 className="mr-1 h-3.5 w-3.5" />
                    Connect
                  </Button>
                )}
              </div>
            </div>
          )
        })}
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
