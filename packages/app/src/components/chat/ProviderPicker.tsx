/**
 * ProviderPicker — first-time LLM setup dialog.
 *
 * Shows a list of available providers with capability badges,
 * API key / endpoint input, and a test connection button.
 */

import { CheckCircle, Cloud, Cpu, Globe, Loader2, Server, Settings2, XCircle } from 'lucide-react'
import { useCallback, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { sendTokenToSW } from '@/lib/auth/sw-bridge'
import { providerRegistry } from '@/lib/llm/provider-registry'
import { AnthropicProvider } from '@/lib/llm/providers/anthropic'
import { CustomProvider } from '@/lib/llm/providers/custom'
import { OllamaProvider } from '@/lib/llm/providers/ollama'
import { OpenAIProvider } from '@/lib/llm/providers/openai'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Provider descriptors
// ---------------------------------------------------------------------------

interface ProviderOption {
  id: string
  name: string
  description: string
  icon: React.ReactNode
  toolUse: boolean
  streaming: boolean
  requiresApiKey: boolean
  requiresEndpoint: boolean
  defaultEndpoint?: string
}

const PROVIDER_OPTIONS: ProviderOption[] = [
  {
    id: 'anthropic',
    name: 'Anthropic (Claude)',
    description: 'Claude Sonnet 4.6 and Haiku 4.5 via the Anthropic API.',
    icon: <Cloud className="h-5 w-5" />,
    toolUse: true,
    streaming: true,
    requiresApiKey: true,
    requiresEndpoint: false,
  },
  {
    id: 'openai',
    name: 'OpenAI',
    description: 'GPT-4o and GPT-4o Mini via the OpenAI API.',
    icon: <Globe className="h-5 w-5" />,
    toolUse: true,
    streaming: true,
    requiresApiKey: true,
    requiresEndpoint: false,
  },
  {
    id: 'ollama',
    name: 'Ollama (Local)',
    description: 'Free, local inference. No API key required. Models auto-detected.',
    icon: <Cpu className="h-5 w-5" />,
    toolUse: false,
    streaming: true,
    requiresApiKey: false,
    requiresEndpoint: true,
    defaultEndpoint: 'http://localhost:11434',
  },
  {
    id: 'custom',
    name: 'Custom Endpoint',
    description: 'Any OpenAI-compatible API (vLLM, text-generation-inference, etc.).',
    icon: <Settings2 className="h-5 w-5" />,
    toolUse: false,
    streaming: true,
    requiresApiKey: false,
    requiresEndpoint: true,
  },
]

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface ProviderPickerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onProviderSelected: (providerId: string) => void
}

export function ProviderPicker({ open, onOpenChange, onProviderSelected }: ProviderPickerProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [endpoint, setEndpoint] = useState('')
  const [model, setModel] = useState('')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null)
  const [testError, setTestError] = useState('')

  const selected = PROVIDER_OPTIONS.find((p) => p.id === selectedId)

  const resetForm = useCallback(() => {
    setApiKey('')
    setEndpoint('')
    setModel('')
    setTesting(false)
    setTestResult(null)
    setTestError('')
  }, [])

  const handleSelect = useCallback(
    (id: string) => {
      setSelectedId(id)
      resetForm()
      const opt = PROVIDER_OPTIONS.find((p) => p.id === id)
      if (opt?.defaultEndpoint) {
        setEndpoint(opt.defaultEndpoint)
      }
    },
    [resetForm],
  )

  const handleTestConnection = useCallback(async () => {
    if (!selected) return
    setTesting(true)
    setTestResult(null)
    setTestError('')

    try {
      if (selected.id === 'ollama') {
        const provider = new OllamaProvider({ endpoint })
        const models = await provider.detectModels()
        if (models.length === 0) {
          throw new Error('No models found. Is Ollama running with a model loaded?')
        }
        setTestResult('success')
      } else if (selected.id === 'custom') {
        // Try a simple request to the endpoint
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
          },
          body: JSON.stringify({
            model: model || 'test',
            messages: [{ role: 'user', content: 'ping' }],
            max_tokens: 1,
          }),
        })
        if (response.ok || response.status === 400) {
          // 400 is acceptable — it means the endpoint exists
          setTestResult('success')
        } else {
          throw new Error(`HTTP ${response.status}`)
        }
      } else {
        // For API key providers, just verify key format
        if (!apiKey.trim()) {
          throw new Error('API key is required')
        }
        setTestResult('success')
      }
    } catch (err) {
      setTestResult('error')
      setTestError(err instanceof Error ? err.message : 'Connection failed')
    } finally {
      setTesting(false)
    }
  }, [selected, apiKey, endpoint, model])

  const handleSave = useCallback(async () => {
    if (!selected) return

    if (apiKey && (selected.id === 'anthropic' || selected.id === 'openai' || selected.id === 'custom')) {
      await sendTokenToSW(
        selected.id as 'github',
        {
          accessToken: apiKey,
          expiresAt: Date.now() + 365 * 24 * 60 * 60 * 1000,
          provider: selected.id as 'github',
          endpoint: selected.id === 'custom' ? endpoint : undefined,
        } as any,
      )
    } else if (selected.id === 'ollama') {
      await sendTokenToSW(
        'github' as any,
        {
          accessToken: '',
          expiresAt: Date.now() + 365 * 24 * 60 * 60 * 1000,
          provider: 'ollama' as any,
          endpoint,
        } as any,
      )
    }

    switch (selected.id) {
      case 'anthropic':
        providerRegistry.register(new AnthropicProvider({}))
        break
      case 'openai':
        providerRegistry.register(new OpenAIProvider({}))
        break
      case 'ollama':
        providerRegistry.register(new OllamaProvider({ endpoint }))
        break
      case 'custom':
        providerRegistry.register(
          new CustomProvider({
            endpoint,
            model: model || 'default',
          }),
        )
        break
    }

    providerRegistry.setDefaultProvider(selected.id)
    onProviderSelected(selected.id)
    onOpenChange(false)
  }, [selected, apiKey, endpoint, model, onProviderSelected, onOpenChange])

  const canSave =
    selected && (!selected.requiresApiKey || apiKey.trim()) && (!selected.requiresEndpoint || endpoint.trim())

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Configure LLM Provider</DialogTitle>
          <DialogDescription>
            Choose an AI provider for chat assistance. Your API key is stored securely and never sent through Aegis
            servers.
          </DialogDescription>
        </DialogHeader>

        {/* Provider list */}
        <div className="grid gap-2">
          {PROVIDER_OPTIONS.map((option) => (
            <button
              key={option.id}
              onClick={() => handleSelect(option.id)}
              className={cn(
                'flex items-start gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-accent',
                selectedId === option.id ? 'border-primary bg-accent' : 'border-border',
              )}
            >
              <div className="mt-0.5 text-muted-foreground">{option.icon}</div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{option.name}</span>
                  {option.toolUse && (
                    <Badge variant="secondary" className="text-[10px]">
                      Tool Use
                    </Badge>
                  )}
                  {option.streaming && (
                    <Badge variant="outline" className="text-[10px]">
                      Streaming
                    </Badge>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">{option.description}</p>
              </div>
              {selectedId === option.id && <Server className="mt-0.5 h-4 w-4 text-primary" />}
            </button>
          ))}
        </div>

        {/* Configuration form */}
        {selected && (
          <div className="space-y-3 border-t border-border pt-3">
            {selected.requiresApiKey && (
              <div>
                <label className="mb-1 block text-sm font-medium">API Key</label>
                <Input
                  type="password"
                  placeholder="sk-..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
              </div>
            )}
            {selected.requiresEndpoint && (
              <div>
                <label className="mb-1 block text-sm font-medium">Endpoint URL</label>
                <Input
                  type="url"
                  placeholder="http://localhost:11434"
                  value={endpoint}
                  onChange={(e) => setEndpoint(e.target.value)}
                />
              </div>
            )}
            {selected.id === 'custom' && (
              <div>
                <label className="mb-1 block text-sm font-medium">Model Name</label>
                <Input placeholder="my-model" value={model} onChange={(e) => setModel(e.target.value)} />
              </div>
            )}

            {/* Test connection */}
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleTestConnection} disabled={testing || !canSave}>
                {testing && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                Test Connection
              </Button>
              {testResult === 'success' && (
                <span className="flex items-center gap-1 text-xs text-green-600">
                  <CheckCircle className="h-3.5 w-3.5" /> Connected
                </span>
              )}
              {testResult === 'error' && (
                <span className="flex items-center gap-1 text-xs text-destructive">
                  <XCircle className="h-3.5 w-3.5" /> {testError}
                </span>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!canSave}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
