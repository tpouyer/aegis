/**
 * ChatView — main chat layout.
 *
 * Composes the message list, message input, and model selector into
 * the full chat interface. Manages the streaming loop that connects
 * the chat store to the active LLM provider.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { Bot, ChevronDown } from 'lucide-react'
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
import { MessageList } from './MessageList'
import { MessageInput } from './MessageInput'
import { ProviderPicker } from './ProviderPicker'
import { useChatStore } from '@/stores/chat'
import { providerRegistry } from '@/lib/llm/provider-registry'
import { buildSystemPrompt } from '@/lib/llm/system-prompt'
import { routeToolCall } from '@/lib/llm/tool-router'
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
      createSession(issueKey, providerId, defaultModel)
    },
    [issueKey, createSession],
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

        const stream = provider.chat({
          model: currentSession.currentModel,
          messages: currentSession.messages.slice(0, -1), // exclude empty assistant msg
          systemPrompt,
          stream: true,
        })

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

            case 'error':
              appendStreamChunk(
                issueKey,
                `\n\n**Error:** ${chunk.error ?? 'Unknown error'}`,
              )
              break

            case 'done':
              break
          }
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          const errorMessage =
            err instanceof Error ? err.message : 'An error occurred'
          appendStreamChunk(issueKey, `\n\n**Error:** ${errorMessage}`)
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

      {/* Messages */}
      <MessageList
        messages={session?.messages ?? []}
        isStreaming={session?.isStreaming ?? false}
      />

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
