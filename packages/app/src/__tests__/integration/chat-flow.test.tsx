/**
 * Integration tests for the chat user journey.
 *
 * Tests the chat flow end-to-end:
 *   - Chat view renders with issue context
 *   - Message input accepts text
 *   - System prompt includes issue context
 *
 * Exercises the ChatView building blocks (MessageList, MessageInput,
 * system prompt builder, and chat store) together. The full ChatView
 * requires provider registry + TanStack providers, so we test through
 * the composable pieces that make up the journey.
 */

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { MessageInput } from '@/components/chat/MessageInput'
import { MessageList } from '@/components/chat/MessageList'
import { buildSystemPrompt } from '@/lib/llm/system-prompt'
import type { ChatMessage } from '@/lib/llm/types'
import { useChatStore } from '@/stores/chat'

// ---------------------------------------------------------------------------
// jsdom polyfills
// ---------------------------------------------------------------------------

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn()
})

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock react-markdown to avoid ESM issues in jsdom
vi.mock('react-markdown', () => ({
  default: ({ children }: { children: string }) => <div data-testid="markdown">{children}</div>,
}))

vi.mock('remark-gfm', () => ({
  default: () => {},
}))

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
// 1. Chat view renders with issue context
// ---------------------------------------------------------------------------

describe('Chat view renders with issue context', () => {
  it('MessageList renders empty state prompt', () => {
    render(<MessageList messages={[]} isStreaming={false} />)
    expect(screen.getByText('Start a conversation to get AI assistance with this issue.')).toBeInTheDocument()
  })

  it('MessageList renders existing messages with correct roles', () => {
    const messages: ChatMessage[] = [
      createMessage({
        id: 'u1',
        role: 'user',
        content: 'How do I fix AEGIS-42?',
      }),
      createMessage({
        id: 'a1',
        role: 'assistant',
        content: 'Looking at the issue, I recommend...',
      }),
    ]

    render(<MessageList messages={messages} isStreaming={false} />)

    expect(screen.getByText('How do I fix AEGIS-42?')).toBeInTheDocument()
    expect(screen.getByText('Looking at the issue, I recommend...')).toBeInTheDocument()
  })

  it('MessageList displays user messages right-aligned and assistant left-aligned', () => {
    const messages: ChatMessage[] = [
      createMessage({ id: 'u1', role: 'user', content: 'User question' }),
      createMessage({ id: 'a1', role: 'assistant', content: 'Assistant answer' }),
    ]

    const { container } = render(<MessageList messages={messages} isStreaming={false} />)

    expect(container.querySelector('.justify-end')).toBeInTheDocument()
    expect(container.querySelector('.justify-start')).toBeInTheDocument()
  })

  it('MessageList shows streaming indicator when isStreaming is true', () => {
    const messages: ChatMessage[] = [createMessage({ id: 'a1', role: 'assistant', content: 'Thinking...' })]

    render(<MessageList messages={messages} isStreaming={true} />)
    expect(screen.getByText('Generating...')).toBeInTheDocument()
  })

  it('chat store creates session with issue context', () => {
    const { createSession: create } = useChatStore.getState()
    create('AEGIS-42', 'anthropic', 'claude-sonnet-4-6')

    const session = useChatStore.getState().sessions.get('AEGIS-42')
    expect(session).toBeDefined()
    expect(session!.issueKey).toBe('AEGIS-42')
    expect(session!.providerId).toBe('anthropic')
    expect(session!.currentModel).toBe('claude-sonnet-4-6')
    expect(session!.messages).toHaveLength(0)
    expect(session!.isStreaming).toBe(false)
  })

  it('chat store adds messages and preserves order', () => {
    const { createSession: create, addMessage } = useChatStore.getState()
    create('AEGIS-42', 'anthropic', 'claude-sonnet-4-6')

    addMessage('AEGIS-42', createMessage({ id: 'u1', role: 'user', content: 'First message' }))
    addMessage('AEGIS-42', createMessage({ id: 'a1', role: 'assistant', content: 'Reply' }))
    addMessage('AEGIS-42', createMessage({ id: 'u2', role: 'user', content: 'Follow-up' }))

    const session = useChatStore.getState().sessions.get('AEGIS-42')
    expect(session!.messages).toHaveLength(3)
    expect(session!.messages[0].content).toBe('First message')
    expect(session!.messages[1].content).toBe('Reply')
    expect(session!.messages[2].content).toBe('Follow-up')
  })
})

// ---------------------------------------------------------------------------
// 2. Message input accepts text
// ---------------------------------------------------------------------------

describe('Message input accepts text', () => {
  it('renders the textarea placeholder', () => {
    const onSend = vi.fn()
    render(<MessageInput onSend={onSend} isStreaming={false} />)

    expect(screen.getByPlaceholderText('Type a message...')).toBeInTheDocument()
  })

  it('accepts typed text input', async () => {
    const user = userEvent.setup()
    const onSend = vi.fn()

    render(<MessageInput onSend={onSend} isStreaming={false} />)

    const textarea = screen.getByPlaceholderText('Type a message...')
    await user.type(textarea, 'Hello from integration test')

    expect(textarea).toHaveValue('Hello from integration test')
  })

  it('calls onSend when send button is clicked', async () => {
    const user = userEvent.setup()
    const onSend = vi.fn()

    render(<MessageInput onSend={onSend} isStreaming={false} />)

    const textarea = screen.getByPlaceholderText('Type a message...')
    await user.type(textarea, 'Test message')

    const sendButton = screen.getByRole('button', { name: 'Send message' })
    await user.click(sendButton)

    expect(onSend).toHaveBeenCalledWith('Test message')
  })

  it('clears input after sending', async () => {
    const user = userEvent.setup()
    const onSend = vi.fn()

    render(<MessageInput onSend={onSend} isStreaming={false} />)

    const textarea = screen.getByPlaceholderText('Type a message...')
    await user.type(textarea, 'Will be cleared')

    const sendButton = screen.getByRole('button', { name: 'Send message' })
    await user.click(sendButton)

    expect(textarea).toHaveValue('')
  })

  it('does not send empty messages', async () => {
    const user = userEvent.setup()
    const onSend = vi.fn()

    render(<MessageInput onSend={onSend} isStreaming={false} />)

    const sendButton = screen.getByRole('button', { name: 'Send message' })
    expect(sendButton).toBeDisabled()

    // Click anyway
    await user.click(sendButton)
    expect(onSend).not.toHaveBeenCalled()
  })

  it('does not send whitespace-only messages', async () => {
    const user = userEvent.setup()
    const onSend = vi.fn()

    render(<MessageInput onSend={onSend} isStreaming={false} />)

    const textarea = screen.getByPlaceholderText('Type a message...')
    await user.type(textarea, '   ')

    // Button should still be disabled (only whitespace)
    const sendButton = screen.getByRole('button', { name: 'Send message' })
    expect(sendButton).toBeDisabled()
  })

  it('shows stop button during streaming', () => {
    const onSend = vi.fn()
    const onStop = vi.fn()

    render(<MessageInput onSend={onSend} onStop={onStop} isStreaming={true} />)

    expect(screen.getByRole('button', { name: 'Stop generating' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Send message' })).not.toBeInTheDocument()
  })

  it('calls onStop when stop button is clicked', async () => {
    const user = userEvent.setup()
    const onSend = vi.fn()
    const onStop = vi.fn()

    render(<MessageInput onSend={onSend} onStop={onStop} isStreaming={true} />)

    const stopButton = screen.getByRole('button', { name: 'Stop generating' })
    await user.click(stopButton)

    expect(onStop).toHaveBeenCalled()
  })

  it('disables input when disabled prop is true', () => {
    const onSend = vi.fn()

    render(<MessageInput onSend={onSend} isStreaming={false} disabled={true} />)

    const textarea = screen.getByPlaceholderText('Type a message...')
    expect(textarea).toBeDisabled()
  })
})

// ---------------------------------------------------------------------------
// 3. System prompt includes issue context
// ---------------------------------------------------------------------------

describe('System prompt includes issue context', () => {
  it('includes issue key and summary in the system prompt', () => {
    const prompt = buildSystemPrompt({
      issueKey: 'AEGIS-42',
      issueSummary: 'Fix login redirect loop',
      supportsToolUse: false,
    })

    expect(prompt).toContain('AEGIS-42')
    expect(prompt).toContain('Fix login redirect loop')
  })

  it('includes issue description when provided', () => {
    const prompt = buildSystemPrompt({
      issueKey: 'AEGIS-42',
      issueSummary: 'Fix login redirect loop',
      issueDescription: 'Users are stuck in an infinite redirect after SSO login.',
      supportsToolUse: false,
    })

    expect(prompt).toContain('Users are stuck in an infinite redirect after SSO login.')
  })

  it('shows "No description provided" when description is omitted', () => {
    const prompt = buildSystemPrompt({
      issueKey: 'AEGIS-42',
      issueSummary: 'Fix login redirect loop',
      supportsToolUse: false,
    })

    expect(prompt).toContain('No description provided.')
  })

  it('includes acceptance criteria when provided', () => {
    const prompt = buildSystemPrompt({
      issueKey: 'AEGIS-42',
      issueSummary: 'Fix login redirect loop',
      acceptanceCriteria: '- Login redirect should complete within 3 seconds\n- No infinite loops',
      supportsToolUse: false,
    })

    expect(prompt).toContain('## Acceptance Criteria')
    expect(prompt).toContain('Login redirect should complete within 3 seconds')
    expect(prompt).toContain('No infinite loops')
  })

  it('inlines org context when tool use is not supported', () => {
    const prompt = buildSystemPrompt({
      issueKey: 'AEGIS-42',
      issueSummary: 'Fix login redirect loop',
      supportsToolUse: false,
      orgContext: [
        { name: 'Coding Standards', body: 'Use TypeScript strict mode.' },
        { name: 'Testing Guidelines', body: 'Write unit tests for all PRs.' },
      ],
    })

    expect(prompt).toContain('## Coding Standards')
    expect(prompt).toContain('Use TypeScript strict mode.')
    expect(prompt).toContain('## Testing Guidelines')
    expect(prompt).toContain('Write unit tests for all PRs.')
  })

  it('does not inline org context when tool use is supported', () => {
    const prompt = buildSystemPrompt({
      issueKey: 'AEGIS-42',
      issueSummary: 'Fix login redirect loop',
      supportsToolUse: true,
      orgContext: [{ name: 'Coding Standards', body: 'Use TypeScript strict mode.' }],
    })

    expect(prompt).not.toContain('Use TypeScript strict mode.')
    expect(prompt).toContain('You have access to tools')
  })

  it('mentions tool availability when supportsToolUse is true', () => {
    const prompt = buildSystemPrompt({
      issueKey: 'AEGIS-42',
      issueSummary: 'Fix login redirect loop',
      supportsToolUse: true,
    })

    expect(prompt).toContain('tools')
    expect(prompt).toContain('coding standards')
  })
})
