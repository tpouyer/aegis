/**
 * ChatView — main chat layout.
 *
 * Composes the message list, message input, and model selector into
 * the full chat interface. Manages the streaming loop that connects
 * the chat store to the active LLM provider.
 */

import { Bot, ChevronDown, MessageCircle, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { EmptyState } from '@/components/shared/EmptyState'
import { Loading } from '@/components/shared/Loading'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { getSuggestedPrompts, PERSONA_SYSTEM_DESCRIPTIONS } from '@/lib/llm/persona-prompts'
import { providerRegistry } from '@/lib/llm/provider-registry'
import { buildSystemPrompt } from '@/lib/llm/system-prompt'
import { routeToolCall } from '@/lib/llm/tool-router'
import type { ChatMessage, ToolDefinition } from '@/lib/llm/types'
import { mcpManager } from '@/lib/mcp/manager'
import { skillManager } from '@/lib/skills/manager'
import { instrumentedChat } from '@/lib/telemetry/instruments/llm'
import { useChatStore } from '@/stores/chat'
import { PERSONA_LABELS, usePersonaStore } from '@/stores/persona'
import { MessageInput } from './MessageInput'
import { MessageList } from './MessageList'
import { ProviderPicker } from './ProviderPicker'

interface ChatViewProps {
  issueKey: string
  issueSummary: string
  issueDescription?: string
  acceptanceCriteria?: string
  className?: string
}

export function ChatView({ issueKey, issueSummary, issueDescription, acceptanceCriteria, className }: ChatViewProps) {
  const { sessions, createSession, addMessage, appendStreamChunk, setStreaming, switchModel, loadSession } =
    useChatStore()

  const session = sessions.get(issueKey)
  const abortRef = useRef<AbortController | null>(null)
  const [showProviderPicker, setShowProviderPicker] = useState(false)
  const [loading, setLoading] = useState(true)

  // Load persisted session on mount
  useEffect(() => {
    loadSession(issueKey).then(() => {
      setLoading(false)
    })
  }, [issueKey, loadSession])

  // Ensure a session exists once loading finishes
  useEffect(() => {
    if (loading) return
    if (sessions.has(issueKey)) return

    const provider = providerRegistry.getDefaultProvider()
    if (!provider) {
      // No provider configured — show picker
      setShowProviderPicker(true)
      return
    }

    const defaultModel = provider.models[0]?.id ?? ''
    createSession(issueKey, provider.id, defaultModel)
  }, [loading, issueKey, sessions, createSession])

  const handleProviderSelected = useCallback(
    (providerId: string) => {
      const provider = providerRegistry.getProvider(providerId)
      if (!provider) return

      const defaultModel = provider.models[0]?.id ?? ''
      if (sessions.has(issueKey)) {
        switchModel(issueKey, defaultModel)
        useChatStore.getState().switchProvider(issueKey, providerId)
      } else {
        createSession(issueKey, providerId, defaultModel)
      }
    },
    [issueKey, sessions, createSession, switchModel],
  )

  // -----------------------------------------------------------------------
  // Send message + streaming loop
  // -----------------------------------------------------------------------

  const handleSend = useCallback(
    async (content: string) => {
      if (!session) return

      const provider = providerRegistry.getProvider(session.providerId)
      if (!provider) return

      // Add user message
      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content,
        timestamp: Date.now(),
      }
      addMessage(issueKey, userMsg)

      // Create assistant placeholder
      const assistantMsg: ChatMessage = {
        id: `asst-${Date.now()}`,
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
      }
      addMessage(issueKey, assistantMsg)

      const mcpTools = mcpManager.getAvailableTools()
      const toolDefinitions: ToolDefinition[] = mcpTools.map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
      }))

      const skillIndex = skillManager.getSkillIndex()
      if (skillIndex) {
        toolDefinitions.push(
          {
            name: 'read_skill_file',
            description: 'Read a file from a skill. Use the skill id from the skills index.',
            inputSchema: {
              type: 'object',
              properties: {
                skillId: { type: 'string', description: 'The skill identifier' },
                path: { type: 'string', description: 'File path (default: SKILL.md)' },
              },
              required: ['skillId'],
            },
          },
          {
            name: 'list_skill_files',
            description: 'List all files in a skill directory.',
            inputSchema: {
              type: 'object',
              properties: { skillId: { type: 'string', description: 'The skill identifier' } },
              required: ['skillId'],
            },
          },
        )
      }

      toolDefinitions.push(
        {
          name: 'executePython',
          description: 'Execute a Python script. Workspace files are mounted at /workspace/.',
          inputSchema: {
            type: 'object',
            properties: { script: { type: 'string', description: 'Python code to execute' } },
            required: ['script'],
          },
        },
        {
          name: 'executeBash',
          description: 'Execute bash commands. Supports cat, grep, sed, find, ls, mkdir, and more.',
          inputSchema: {
            type: 'object',
            properties: { script: { type: 'string', description: 'Bash commands to execute' } },
            required: ['script'],
          },
        },
      )

      const personaRole = usePersonaStore.getState().role
      const systemPrompt = buildSystemPrompt({
        issueKey: issueKey || undefined,
        issueSummary,
        issueDescription,
        acceptanceCriteria,
        supportsToolUse: provider.supportsToolUse,
        persona: {
          role: PERSONA_LABELS[personaRole],
          description: PERSONA_SYSTEM_DESCRIPTIONS[personaRole],
        },
        mcpTools: mcpTools.map((t) => ({ name: t.name, description: t.description, serverName: t.serverName })),
        skillIndex: skillIndex || undefined,
      })

      // Start streaming
      setStreaming(issueKey, true)
      const controller = new AbortController()
      abortRef.current = controller

      try {
        const currentSession = useChatStore.getState().sessions.get(issueKey)
        if (!currentSession) return

        const rawStream = provider.chat({
          model: currentSession.currentModel,
          messages: currentSession.messages.slice(0, -1),
          systemPrompt,
          tools: toolDefinitions.length > 0 ? toolDefinitions : undefined,
          stream: true,
        })
        const stream = instrumentedChat(session.providerId, currentSession.currentModel, rawStream)

        for await (const chunk of stream) {
          if (controller.signal.aborted) break

          switch (chunk.type) {
            case 'text':
              if (chunk.content) {
                appendStreamChunk(issueKey, chunk.content)
              }
              break

            case 'tool_call':
              if (chunk.toolCall) {
                // Execute the tool call
                const result = await routeToolCall(chunk.toolCall)
                // Update the assistant message with tool call + result
                const sess = useChatStore.getState().sessions.get(issueKey)
                if (sess && sess.messages.length > 0) {
                  const msgs = [...sess.messages]
                  const lastMsg = msgs[msgs.length - 1]
                  msgs[msgs.length - 1] = {
                    ...lastMsg,
                    toolCalls: [...(lastMsg.toolCalls ?? []), chunk.toolCall],
                    toolResults: [...(lastMsg.toolResults ?? []), result],
                  }
                  // Update session in store
                  const next = new Map(useChatStore.getState().sessions)
                  next.set(issueKey, { ...sess, messages: msgs })
                  useChatStore.setState({ sessions: next })
                }
              }
              break

            case 'error': {
              const errMsg = chunk.error ?? 'Unknown error'
              const sess = useChatStore.getState().sessions.get(issueKey)
              if (sess) {
                const msgs = [...sess.messages]
                const lastMsg = msgs[msgs.length - 1]
                msgs[msgs.length - 1] = { ...lastMsg, error: errMsg }
                const next = new Map(useChatStore.getState().sessions)
                next.set(issueKey, { ...sess, messages: msgs })
                useChatStore.setState({ sessions: next })
              }
              break
            }

            case 'done':
              break
          }
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          const errorMessage = err instanceof Error ? err.message : 'An error occurred'
          const sess = useChatStore.getState().sessions.get(issueKey)
          if (sess) {
            const msgs = [...sess.messages]
            const lastMsg = msgs[msgs.length - 1]
            msgs[msgs.length - 1] = { ...lastMsg, error: errorMessage }
            const next = new Map(useChatStore.getState().sessions)
            next.set(issueKey, { ...sess, messages: msgs })
            useChatStore.setState({ sessions: next })
          }
        }
      } finally {
        setStreaming(issueKey, false)
        abortRef.current = null
      }
    },
    [
      session,
      issueKey,
      issueSummary,
      issueDescription,
      acceptanceCriteria,
      addMessage,
      appendStreamChunk,
      setStreaming,
    ],
  )

  const handleStop = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  useEffect(() => {
    const onStopStreaming = () => abortRef.current?.abort()
    document.addEventListener('aegis:stop-streaming', onStopStreaming)
    return () => document.removeEventListener('aegis:stop-streaming', onStopStreaming)
  }, [])

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  if (loading) {
    return <Loading message="Loading chat session..." className="h-full" />
  }

  const provider = session ? providerRegistry.getProvider(session.providerId) : providerRegistry.getDefaultProvider()

  return (
    <div className={`flex h-full flex-col ${className ?? ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border bg-card px-4 py-2">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-primary" />
          <span className="text-sm font-medium text-foreground">{issueKey || 'General Chat'}</span>
          {issueSummary && <span className="text-sm text-muted-foreground">{issueSummary}</span>}
        </div>

        {/* Model selector + clear chat */}
        <div className="flex items-center gap-1">
          {session && session.messages.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              title="Clear chat"
              onClick={() => {
                useChatStore.getState().clearSession(issueKey)
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
          {!provider && (
            <Button variant="outline" size="sm" onClick={() => setShowProviderPicker(true)}>
              Configure AI Provider
            </Button>
          )}
          {(() => {
            const allProviders = providerRegistry.listProviders()
            if (allProviders.length === 0) return null
            return (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1">
                    {session?.currentModel ?? provider?.models[0]?.name ?? 'Model'}
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="max-h-80 overflow-y-auto">
                  {allProviders.map((p, idx) => (
                    <div key={p.id}>
                      {idx > 0 && <DropdownMenuSeparator />}
                      <DropdownMenuLabel className="text-xs">{p.name}</DropdownMenuLabel>
                      {p.models.map((m) => {
                        const isActive = session?.providerId === p.id && session?.currentModel === m.id
                        return (
                          <DropdownMenuItem
                            key={`${p.id}-${m.id}`}
                            onClick={() => {
                              if (session?.providerId !== p.id) {
                                useChatStore.getState().switchProvider(issueKey, p.id)
                              }
                              switchModel(issueKey, m.id)
                            }}
                          >
                            <span className={`flex-1 ${isActive ? 'font-medium' : ''}`}>{m.name}</span>
                            {isActive && (
                              <Badge variant="default" className="ml-2 text-[10px]">
                                Active
                              </Badge>
                            )}
                            {m.supportsToolUse && !isActive && (
                              <Badge variant="secondary" className="ml-2 text-[10px]">
                                Tools
                              </Badge>
                            )}
                          </DropdownMenuItem>
                        )
                      })}
                    </div>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setShowProviderPicker(true)}>Add provider...</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )
          })()}
        </div>
      </div>

      {/* Messages or empty state */}
      {session && session.messages.length === 0 ? (
        <ChatEmptyState issueKey={issueKey} onSend={handleSend} />
      ) : (
        <MessageList
          messages={session?.messages ?? []}
          isStreaming={session?.isStreaming ?? false}
          onRetry={handleSend}
        />
      )}

      {/* Input */}
      <MessageInput
        onSend={handleSend}
        onStop={handleStop}
        isStreaming={session?.isStreaming ?? false}
        disabled={!session}
      />

      {/* Provider picker dialog */}
      <ProviderPicker
        open={showProviderPicker}
        onOpenChange={setShowProviderPicker}
        onProviderSelected={handleProviderSelected}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Chat empty state with suggested prompts
// ---------------------------------------------------------------------------

function ChatEmptyState({ issueKey, onSend }: { issueKey?: string; onSend: (content: string) => void }) {
  const role = usePersonaStore((s) => s.role)
  const prompts = getSuggestedPrompts(role, issueKey)
  const title = issueKey ? `Start a conversation about ${issueKey}` : 'Start a conversation'
  const description = issueKey
    ? `Ask questions about this issue from a ${PERSONA_LABELS[role]} perspective.`
    : `Ask anything — org context, processes, or general questions as a ${PERSONA_LABELS[role]}.`

  return (
    <div className="flex flex-1 items-center justify-center overflow-y-auto p-6">
      <EmptyState variant="info" icon={MessageCircle} title={title} description={description}>
        <div className="mt-2 w-full space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Suggested prompts</p>
          <ul className="space-y-1.5" aria-label="Suggested prompts">
            {prompts.map((prompt) => (
              <li key={prompt}>
                <button
                  type="button"
                  className="w-full rounded-md border border-border px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-accent"
                  onClick={() => onSend(prompt)}
                >
                  {prompt}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </EmptyState>
    </div>
  )
}
