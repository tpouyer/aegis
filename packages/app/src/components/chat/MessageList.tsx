/**
 * MessageList — renders the list of chat messages.
 *
 * - User messages: right-aligned with primary background
 * - Assistant messages: left-aligned with markdown rendering
 * - Tool call/result pairs: collapsible cards within assistant messages
 * - Code blocks: syntax highlighted with copy button
 */

import { useEffect, useRef, useCallback, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Copy, Check, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ToolResult } from './ToolResult'
import type { ChatMessage } from '@/lib/llm/types'

interface MessageListProps {
  messages: ChatMessage[]
  isStreaming: boolean
  onRetry?: (content: string) => void
  className?: string
}

export function MessageList({ messages, isStreaming, onRetry, className }: MessageListProps) {
  const endRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, messages.length > 0 ? messages[messages.length - 1]?.content : undefined])

  // Find the last user message content for retry
  const lastUserContent = useCallback(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user') return messages[i].content
    }
    return null
  }, [messages])

  const handleRetry = useCallback(() => {
    const content = lastUserContent()
    if (content && onRetry) onRetry(content)
  }, [lastUserContent, onRetry])

  if (messages.length === 0) {
    return (
      <div className={`flex flex-1 items-center justify-center ${className ?? ''}`}>
        <p className="text-sm text-muted-foreground">
          Start a conversation to get AI assistance with this issue.
        </p>
      </div>
    )
  }

  return (
    <ScrollArea className={`flex-1 ${className ?? ''}`}>
      <div className="space-y-4 p-4">
        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            onRetry={message.error && onRetry ? handleRetry : undefined}
          />
        ))}
        {isStreaming && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-primary" />
            Generating...
          </div>
        )}
        <div ref={endRef} />
      </div>
    </ScrollArea>
  )
}

// ---------------------------------------------------------------------------
// Message bubble
// ---------------------------------------------------------------------------

function MessageBubble({
  message,
  onRetry,
}: {
  message: ChatMessage
  onRetry?: () => void
}) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-lg px-4 py-2 ${
          isUser
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted text-foreground'
        }`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap text-sm">{message.content}</p>
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                code: CodeBlock,
              }}
            >
              {message.content}
            </ReactMarkdown>
          </div>
        )}

        {/* Tool calls / results */}
        {message.toolCalls?.map((tc) => {
          const result = message.toolResults?.find(
            (tr) => tr.toolCallId === tc.id,
          )
          return <ToolResult key={tc.id} toolCall={tc} toolResult={result} />
        })}

        {/* Error banner */}
        {message.error && (
          <div className="mt-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {message.error}
            {onRetry && (
              <Button
                variant="ghost"
                size="sm"
                className="ml-2 h-6 gap-1 px-2 text-xs text-destructive hover:text-destructive"
                onClick={onRetry}
              >
                <RefreshCw className="h-3 w-3" />
                Retry
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Code block with copy button
// ---------------------------------------------------------------------------

function CodeBlock({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLElement>) {
  const [copied, setCopied] = useState(false)

  const isInline = !className && typeof children === 'string'

  const handleCopy = useCallback(() => {
    const text =
      typeof children === 'string'
        ? children
        : (children as React.ReactElement)?.props?.children ?? ''

    navigator.clipboard.writeText(String(text)).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [children])

  if (isInline) {
    return (
      <code className="rounded bg-muted px-1.5 py-0.5 text-sm" {...props}>
        {children}
      </code>
    )
  }

  return (
    <div className="group relative">
      <pre className="overflow-x-auto rounded-md bg-background p-3 text-sm">
        <code className={className} {...props}>
          {children}
        </code>
      </pre>
      <Button
        variant="ghost"
        size="icon"
        className="absolute right-2 top-2 h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100"
        onClick={handleCopy}
        aria-label="Copy code"
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-green-500" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
      </Button>
    </div>
  )
}
