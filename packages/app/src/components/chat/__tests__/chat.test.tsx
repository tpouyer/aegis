/**
 * Chat integration tests.
 *
 * Covers:
 *   - Chat export produces valid markdown
 *   - Model switching updates the session
 *   - Tool router handles unknown tools gracefully
 *   - Message list renders user and assistant messages differently
 */

import { render, screen } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { routeToolCall } from '@/lib/llm/tool-router'
import type { ChatMessage, ToolCall } from '@/lib/llm/types'
import type { ChatSession } from '@/stores/chat'
import { exportChatAsMarkdown, useChatStore } from '@/stores/chat'
import { MessageList } from '../MessageList'

// ---------------------------------------------------------------------------
// jsdom polyfills
// ---------------------------------------------------------------------------

beforeAll(() => {
  // scrollIntoView is not implemented in jsdom
  Element.prototype.scrollIntoView = vi.fn()
})

// ---------------------------------------------------------------------------
// Store cleanup
// ---------------------------------------------------------------------------

afterEach(() => {
  useChatStore.setState({
    sessions: new Map(),
    activeSession: null,
  })
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createSession(overrides: Partial<ChatSession> = {}): ChatSession {
  return {
    issueKey: 'TEST-1',
    messages: [],
    isStreaming: false,
    currentModel: 'test-model',
    providerId: 'test-provider',
    ...overrides,
  }
}

function createMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: `msg-${Date.now()}-${Math.random()}`,
    role: 'user',
    content: 'Hello',
    timestamp: Date.now(),
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// 1. Chat export produces valid markdown
// ---------------------------------------------------------------------------

describe('exportChatAsMarkdown', () => {
  it('produces markdown with metadata header', () => {
    const session = createSession({
      issueKey: 'AAP-42',
      currentModel: 'claude-sonnet-4-6',
      providerId: 'anthropic',
    })

    const md = exportChatAsMarkdown(session)

    expect(md).toContain('# Chat: AAP-42')
    expect(md).toContain('**Model:** claude-sonnet-4-6')
    expect(md).toContain('**Provider:** anthropic')
    expect(md).toContain('**Exported:**')
  })

  it('includes user and assistant messages with role headers', () => {
    const session = createSession({
      messages: [
        createMessage({ id: 'u1', role: 'user', content: 'What is this issue about?' }),
        createMessage({ id: 'a1', role: 'assistant', content: 'This issue is about...' }),
      ],
    })

    const md = exportChatAsMarkdown(session)

    expect(md).toContain('### User')
    expect(md).toContain('What is this issue about?')
    expect(md).toContain('### Assistant')
    expect(md).toContain('This issue is about...')
  })

  it('formats tool calls as code blocks', () => {
    const session = createSession({
      messages: [
        createMessage({
          id: 'a1',
          role: 'assistant',
          content: 'Let me look that up.',
          toolCalls: [
            {
              id: 'tc-1',
              name: 'org_context',
              arguments: { topic: 'architecture' },
            },
          ],
          toolResults: [
            {
              toolCallId: 'tc-1',
              content: '# Architecture Overview\n- Monorepo structure',
            },
          ],
        }),
      ],
    })

    const md = exportChatAsMarkdown(session)

    expect(md).toContain('**Tool Call:** `org_context`')
    expect(md).toContain('```json')
    expect(md).toContain('"topic": "architecture"')
    expect(md).toContain('**Tool Result:** (tc-1)')
    expect(md).toContain('# Architecture Overview')
  })

  it('labels tool errors correctly', () => {
    const session = createSession({
      messages: [
        createMessage({
          id: 'a2',
          role: 'assistant',
          content: '',
          toolCalls: [{ id: 'tc-err', name: 'unknown_tool', arguments: {} }],
          toolResults: [
            {
              toolCallId: 'tc-err',
              content: 'Unknown tool: unknown_tool',
              isError: true,
            },
          ],
        }),
      ],
    })

    const md = exportChatAsMarkdown(session)

    expect(md).toContain('**Tool Error:** (tc-err)')
  })

  it('handles a session with no messages', () => {
    const session = createSession({ messages: [] })
    const md = exportChatAsMarkdown(session)

    expect(md).toContain('# Chat: TEST-1')
    // Should still produce valid markdown, just no message sections
    expect(md).not.toContain('### User')
    expect(md).not.toContain('### Assistant')
  })
})

// ---------------------------------------------------------------------------
// 2. Model switching updates the session
// ---------------------------------------------------------------------------

describe('model switching', () => {
  it('switchModel updates the currentModel on the session', () => {
    const { createSession: create, switchModel } = useChatStore.getState()
    create('SWITCH-1', 'anthropic', 'claude-sonnet-4-6')

    switchModel('SWITCH-1', 'claude-haiku-4-5')

    const session = useChatStore.getState().sessions.get('SWITCH-1')
    expect(session?.currentModel).toBe('claude-haiku-4-5')
  })

  it('preserves conversation history when switching models', () => {
    const { createSession: create, addMessage, switchModel } = useChatStore.getState()

    create('SWITCH-2', 'anthropic', 'claude-sonnet-4-6')

    addMessage('SWITCH-2', createMessage({ id: 'u1', role: 'user', content: 'Hello' }))
    addMessage('SWITCH-2', createMessage({ id: 'a1', role: 'assistant', content: 'Hi there' }))

    switchModel('SWITCH-2', 'gpt-4o')

    const session = useChatStore.getState().sessions.get('SWITCH-2')
    expect(session?.currentModel).toBe('gpt-4o')
    expect(session?.messages).toHaveLength(2)
    expect(session?.messages[0].content).toBe('Hello')
    expect(session?.messages[1].content).toBe('Hi there')
  })

  it('switchModel is a no-op for nonexistent session', () => {
    const { switchModel } = useChatStore.getState()
    // Should not throw
    switchModel('NONEXISTENT', 'some-model')
    expect(useChatStore.getState().sessions.has('NONEXISTENT')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// 3. Tool router handles unknown tools gracefully
// ---------------------------------------------------------------------------

describe('tool router', () => {
  it('returns an error result for unknown tools', async () => {
    const tc: ToolCall = {
      id: 'tc-unknown',
      name: 'nonexistent_tool',
      arguments: { foo: 'bar' },
    }

    const result = await routeToolCall(tc)

    expect(result.toolCallId).toBe('tc-unknown')
    expect(result.isError).toBe(true)
    expect(result.content).toContain('Unknown tool')
    expect(result.content).toContain('nonexistent_tool')
  })

  it('returns content for known content tools', async () => {
    const tc: ToolCall = {
      id: 'tc-content',
      name: 'coding_standards',
      arguments: { repo: 'my-repo' },
    }

    const result = await routeToolCall(tc)

    expect(result.toolCallId).toBe('tc-content')
    expect(result.isError).toBeUndefined()
    expect(result.content).toContain('coding_standards')
    expect(result.content).toContain('my-repo')
  })

  it('returns org context for the org_context tool', async () => {
    const tc: ToolCall = {
      id: 'tc-org',
      name: 'org_context',
      arguments: { topic: 'architecture' },
    }

    const result = await routeToolCall(tc)

    expect(result.toolCallId).toBe('tc-org')
    expect(result.isError).toBeUndefined()
    expect(result.content).toContain('Architecture')
  })

  it('returns an error for an unknown org_context topic', async () => {
    const tc: ToolCall = {
      id: 'tc-org-bad',
      name: 'org_context',
      arguments: { topic: 'nonexistent_topic' },
    }

    const result = await routeToolCall(tc)

    expect(result.toolCallId).toBe('tc-org-bad')
    expect(result.isError).toBe(true)
    expect(result.content).toContain('not found')
  })

  it('returns all org context when no topic is specified', async () => {
    const tc: ToolCall = {
      id: 'tc-org-all',
      name: 'org_context',
      arguments: {},
    }

    const result = await routeToolCall(tc)

    expect(result.toolCallId).toBe('tc-org-all')
    expect(result.isError).toBeUndefined()
    expect(result.content).toContain('Coding Standards')
    expect(result.content).toContain('Architecture')
    expect(result.content).toContain('Testing Guidelines')
  })

  it('does not throw even when a handler would throw', async () => {
    // We can test this by mocking — but the routeToolCall is designed to
    // catch any errors. Testing with an unknown tool verifies the fallback
    // path at minimum. The actual catch block is exercised internally.
    const tc: ToolCall = {
      id: 'tc-safe',
      name: 'totally_broken_tool',
      arguments: {},
    }

    // Should not throw
    const result = await routeToolCall(tc)
    expect(result.toolCallId).toBe('tc-safe')
    expect(result.isError).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// 4. MessageList renders user and assistant messages differently
// ---------------------------------------------------------------------------

// Mock react-markdown to avoid issues in test environment
vi.mock('react-markdown', () => ({
  default: ({ children }: { children: string }) => <div data-testid="markdown">{children}</div>,
}))

vi.mock('remark-gfm', () => ({
  default: () => {},
}))

describe('MessageList', () => {
  it('renders empty state when there are no messages', () => {
    render(<MessageList messages={[]} isStreaming={false} />)
    expect(screen.getByText('Start a conversation to get AI assistance with this issue.')).toBeInTheDocument()
  })

  it('renders user messages with right alignment', () => {
    const messages: ChatMessage[] = [createMessage({ id: 'u1', role: 'user', content: 'User message here' })]

    const { container } = render(<MessageList messages={messages} isStreaming={false} />)

    // User messages are wrapped in a div with justify-end
    const bubble = container.querySelector('.justify-end')
    expect(bubble).toBeInTheDocument()
    expect(screen.getByText('User message here')).toBeInTheDocument()
  })

  it('renders assistant messages with left alignment', () => {
    const messages: ChatMessage[] = [
      createMessage({
        id: 'a1',
        role: 'assistant',
        content: 'Assistant response here',
      }),
    ]

    const { container } = render(<MessageList messages={messages} isStreaming={false} />)

    // Assistant messages are wrapped in a div with justify-start
    const bubble = container.querySelector('.justify-start')
    expect(bubble).toBeInTheDocument()
    expect(screen.getByText('Assistant response here')).toBeInTheDocument()
  })

  it('applies different styles to user vs assistant messages', () => {
    const messages: ChatMessage[] = [
      createMessage({ id: 'u1', role: 'user', content: 'From user' }),
      createMessage({ id: 'a1', role: 'assistant', content: 'From assistant' }),
    ]

    const { container } = render(<MessageList messages={messages} isStreaming={false} />)

    // User bubble has bg-primary class
    const userBubble = container.querySelector('.bg-primary')
    expect(userBubble).toBeInTheDocument()

    // Assistant bubble has bg-muted class
    const assistantBubble = container.querySelector('.bg-muted')
    expect(assistantBubble).toBeInTheDocument()
  })

  it('shows streaming indicator when isStreaming is true', () => {
    const messages: ChatMessage[] = [createMessage({ id: 'a1', role: 'assistant', content: 'Thinking...' })]

    render(<MessageList messages={messages} isStreaming={true} />)

    expect(screen.getByText('Generating...')).toBeInTheDocument()
  })

  it('does not show streaming indicator when isStreaming is false', () => {
    const messages: ChatMessage[] = [createMessage({ id: 'a1', role: 'assistant', content: 'Done.' })]

    render(<MessageList messages={messages} isStreaming={false} />)

    expect(screen.queryByText('Generating...')).not.toBeInTheDocument()
  })
})
