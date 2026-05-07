/**
 * Chat store — Zustand store for AI chat sessions.
 *
 * Each chat session is scoped to a Jira issue key. Sessions persist
 * across page reloads via IndexedDB (using the existing CacheStore).
 *
 * Session TTL: 7 days.
 */

import { create } from 'zustand'
import { CacheStore } from '@/lib/cache/indexeddb'
import type { ChatMessage, ToolCall, ToolResult } from '@/lib/llm/types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export function sessionKey(issueKey: string, providerId: string, modelId: string): string {
  return `${issueKey}|${providerId}|${modelId}`
}

export interface ChatSession {
  issueKey: string
  messages: ChatMessage[]
  isStreaming: boolean
  currentModel: string
  providerId: string
}

interface ChatState {
  sessions: Map<string, ChatSession>
  activeSession: string | null

  // Actions
  createSession: (issueKey: string, providerId: string, model: string) => void
  setActiveSession: (issueKey: string | null) => void
  addMessage: (issueKey: string, message: ChatMessage) => void
  appendStreamChunk: (issueKey: string, content: string) => void
  setStreaming: (issueKey: string, streaming: boolean) => void
  switchModel: (issueKey: string, model: string) => void
  switchProvider: (issueKey: string, providerId: string) => void
  clearSession: (issueKey: string) => void
  getSession: (issueKey: string) => ChatSession | undefined

  // Persistence
  loadSession: (issueKey: string) => Promise<void>
  persistSession: (issueKey: string) => Promise<void>
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

const CACHE_DB = 'aegis-chat'
const CACHE_STORE = 'sessions'
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

const chatCache = new CacheStore(CACHE_DB, CACHE_STORE)

/**
 * Serializable representation of a ChatSession for IndexedDB storage.
 */
interface PersistedSession {
  issueKey: string
  messages: ChatMessage[]
  currentModel: string
  providerId: string
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useChatStore = create<ChatState>((set, get) => ({
  sessions: new Map(),
  activeSession: null,

  createSession(issueKey, providerId, model) {
    const { sessions } = get()
    if (sessions.has(issueKey)) return

    const session: ChatSession = {
      issueKey,
      messages: [],
      isStreaming: false,
      currentModel: model,
      providerId,
    }

    const next = new Map(sessions)
    next.set(issueKey, session)
    set({ sessions: next, activeSession: issueKey })
  },

  setActiveSession(issueKey) {
    set({ activeSession: issueKey })
  },

  addMessage(issueKey, message) {
    const { sessions } = get()
    const session = sessions.get(issueKey)
    if (!session) return

    const updated: ChatSession = {
      ...session,
      messages: [...session.messages, message],
    }

    const next = new Map(sessions)
    next.set(issueKey, updated)
    set({ sessions: next })

    // Persist asynchronously
    get().persistSession(issueKey)
  },

  appendStreamChunk(issueKey, content) {
    const { sessions } = get()
    const session = sessions.get(issueKey)
    if (!session || session.messages.length === 0) return

    const messages = [...session.messages]
    const lastMsg = messages[messages.length - 1]

    if (lastMsg.role !== 'assistant') return

    messages[messages.length - 1] = {
      ...lastMsg,
      content: lastMsg.content + content,
    }

    const next = new Map(sessions)
    next.set(issueKey, { ...session, messages })
    set({ sessions: next })
  },

  setStreaming(issueKey, streaming) {
    const { sessions } = get()
    const session = sessions.get(issueKey)
    if (!session) return

    const next = new Map(sessions)
    next.set(issueKey, { ...session, isStreaming: streaming })
    set({ sessions: next })

    // Persist when streaming ends
    if (!streaming) {
      get().persistSession(issueKey)
    }
  },

  switchModel(issueKey, model) {
    const { sessions } = get()
    const session = sessions.get(issueKey)
    if (!session) return

    const next = new Map(sessions)
    next.set(issueKey, { ...session, currentModel: model })
    set({ sessions: next })

    get().persistSession(issueKey)
  },

  switchProvider(issueKey, providerId) {
    const { sessions } = get()
    const session = sessions.get(issueKey)
    if (!session) return

    const next = new Map(sessions)
    next.set(issueKey, { ...session, providerId })
    set({ sessions: next })

    get().persistSession(issueKey)
  },

  clearSession(issueKey) {
    const { sessions, activeSession } = get()
    const next = new Map(sessions)
    next.delete(issueKey)
    set({
      sessions: next,
      activeSession: activeSession === issueKey ? null : activeSession,
    })

    chatCache.delete(`session:${issueKey}`).catch(() => {
      // Ignore cache deletion errors
    })
  },

  getSession(issueKey) {
    return get().sessions.get(issueKey)
  },

  async loadSession(issueKey) {
    const { sessions } = get()
    if (sessions.has(issueKey)) return

    try {
      const persisted = await chatCache.get<PersistedSession>(`session:${issueKey}`)
      if (!persisted) return

      const session: ChatSession = {
        issueKey: persisted.issueKey,
        messages: persisted.messages,
        isStreaming: false,
        currentModel: persisted.currentModel,
        providerId: persisted.providerId,
      }

      const next = new Map(get().sessions)
      next.set(issueKey, session)
      set({ sessions: next })
    } catch {
      // Failed to load from cache — start fresh
    }
  },

  async persistSession(issueKey) {
    const session = get().sessions.get(issueKey)
    if (!session) return

    // Strip transient `error` field from messages before persisting
    const cleanMessages = session.messages.map(({ error: _error, ...msg }) => msg)

    const persisted: PersistedSession = {
      issueKey: session.issueKey,
      messages: cleanMessages,
      currentModel: session.currentModel,
      providerId: session.providerId,
    }

    try {
      await chatCache.set(`session:${issueKey}`, persisted, SESSION_TTL_MS)
    } catch {
      // Ignore persistence errors — session is still in memory
    }
  },
}))

// ---------------------------------------------------------------------------
// Chat export
// ---------------------------------------------------------------------------

/**
 * Format a tool call as a markdown code block.
 */
function formatToolCall(tc: ToolCall): string {
  const parts: string[] = []
  parts.push(`**Tool Call:** \`${tc.name}\``)
  parts.push('```json')
  parts.push(JSON.stringify(tc.arguments, null, 2))
  parts.push('```')
  return parts.join('\n')
}

/**
 * Format a tool result as a markdown code block.
 */
function formatToolResult(tr: ToolResult): string {
  const parts: string[] = []
  const label = tr.isError ? 'Tool Error' : 'Tool Result'
  parts.push(`**${label}:** (${tr.toolCallId})`)
  parts.push('```')
  parts.push(tr.content)
  parts.push('```')
  return parts.join('\n')
}

/**
 * Export a chat session as markdown.
 *
 * Format:
 *   - Metadata header (issue key, model, export date)
 *   - Messages with role headers
 *   - Tool call/result blocks as code blocks
 */
export function exportChatAsMarkdown(session: ChatSession): string {
  const parts: string[] = []

  // Metadata header
  parts.push(`# Chat: ${session.issueKey}`)
  parts.push('')
  parts.push(`- **Model:** ${session.currentModel}`)
  parts.push(`- **Provider:** ${session.providerId}`)
  parts.push(`- **Exported:** ${new Date().toISOString()}`)
  parts.push('')
  parts.push('---')
  parts.push('')

  // Messages
  for (const msg of session.messages) {
    const roleLabel = msg.role === 'user' ? 'User' : msg.role === 'assistant' ? 'Assistant' : 'System'
    const timestamp = new Date(msg.timestamp).toLocaleString()

    parts.push(`### ${roleLabel}`)
    parts.push(`_${timestamp}_`)
    parts.push('')

    if (msg.content) {
      parts.push(msg.content)
      parts.push('')
    }

    // Tool calls
    if (msg.toolCalls && msg.toolCalls.length > 0) {
      for (const tc of msg.toolCalls) {
        parts.push(formatToolCall(tc))
        parts.push('')

        // Find matching result
        const tr = msg.toolResults?.find((r) => r.toolCallId === tc.id)
        if (tr) {
          parts.push(formatToolResult(tr))
          parts.push('')
        }
      }
    }

    parts.push('---')
    parts.push('')
  }

  return parts.join('\n').trimEnd()
}
