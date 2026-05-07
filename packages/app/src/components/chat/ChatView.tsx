/**
 * ChatView — main chat layout.
 *
 * Composes the message list, message input, and model selector into
 * the full chat interface. Manages the streaming loop that connects
 * the chat store to the active LLM provider.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { Bot, ChevronDown, MessageCircle } from 'lucide-react'
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
import { Loading } from '@/components/shared/Loading'
import { EmptyState } from '@/components/shared/EmptyState'
import { MessageList } from './MessageList'
import { MessageInput } from './MessageInput'
import { ProviderPicker } from './ProviderPicker'
import { useChatStore } from '@/stores/chat'
import { providerRegistry } from '@/lib/llm/provider-registry'
import { buildSystemPrompt } from '@/lib/llm/system-prompt'
import { routeToolCall } from '@/lib/llm/tool-router'
import { instrumentedChat } from '@/lib/telemetry/instruments/llm'
import type { ChatMessage, ChatChunk } from '@/lib/llm/types'

interface ChatViewProps {
  issueKey: string
  issueSummary: string
  issueDescription?: string
  acceptanceCriteria?: string
  className?: string
}

export function ChatView({
  issueKey,
  issueSummary,
  issueDescription,
  acceptanceCriteria,
  className,
}: ChatViewProps) {
  const {
    sessions,
    createSession,
    addMessage,
    appendStreamChunk,
    setStreaming,
    switchModel,
    loadSession,
  } = useChatStore()

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

      // Build system prompt
      const systemPrompt = buildSystemPrompt({
        issueKey,
        issueSummary,
        issueDescription,
        acceptanceCriteria,
        supportsToolUse: provider.supportsToolUse,
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
          const errorMessage =
            err instanceof Error ? err.message : 'An error occurred'
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

  const handleModelSwitch = useCallback(
    (modelId: string) => {
      switchModel(issueKey, modelId)
    },
    [issueKey, switchModel],
  )

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  if (loading) {
    return <Loading message="Loading chat session..." className="h-full" />
  }

  const provider = session
    ? providerRegistry.getProvider(session.providerId)
    : providerRegistry.getDefaultProvider()

  return (
    <div className={`flex h-full flex-col ${className ?? ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border bg-card px-4 py-2">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-primary" />
          <span className="text-sm font-medium text-foreground">
            {issueKey}
          </span>
          <span className="text-sm text-muted-foreground">{issueSummary}</span>
        </div>

        {/* Model selector */}
        {provider && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1">
                {session?.currentModel ?? provider.models[0]?.name ?? 'Model'}
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{provider.name}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {provider.models.map((model) => (
                <DropdownMenuItem
                  key={model.id}
                  onClick={() => handleModelSwitch(model.id)}
                >
                  <span className="flex-1">{model.name}</span>
                  {model.supportsToolUse && (
                    <Badge variant="secondary" className="ml-2 text-[10px]">
                      Tools
                    </Badge>
                  )}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setShowProviderPicker(true)}
              >
                Change provider...
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
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

const SUGGESTED_PROMPTS = [
  'What are the acceptance criteria for this issue?',
  'Suggest an implementation approach for this issue',
  'What files in the codebase are most relevant?',
  'Are there any potential edge cases I should consider?',
]

function ChatEmptyState({
  issueKey,
  onSend,
}: {
  issueKey: string
  onSend: (content: string) => void
}) {
  return (
    <div className="flex flex-1 items-center justify-center overflow-y-auto p-6">
      <EmptyState
        variant="info"
        icon={MessageCircle}
        title={`Start a conversation about ${issueKey}`}
        description="Ask the AI assistant about implementation approaches, coding standards, or anything related to this issue."
      >
        <div className="mt-2 w-full space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            Suggested prompts
          </p>
          <ul className="space-y-1.5" role="list" aria-label="Suggested prompts">
            {SUGGESTED_PROMPTS.map((prompt) => (
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
