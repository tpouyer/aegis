import { fireEvent, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Mocks — must be set up before importing the component under test
// ---------------------------------------------------------------------------

// Capture the component from createFileRoute
let CapturedComponent: React.ComponentType | undefined

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (opts: { component: React.ComponentType }) => {
    CapturedComponent = opts.component
    return { component: opts.component }
  },
}))

// Mock the sw-bridge so AuthManager doesn't need a real Service Worker
vi.mock('@/lib/auth/sw-bridge', () => ({
  sendTokenToSW: vi.fn().mockResolvedValue(undefined),
  clearTokenInSW: vi.fn().mockResolvedValue(undefined),
}))

// Mock the auth manager with controllable state
const mockIsConnected = vi.fn().mockReturnValue(false)
const mockDisconnect = vi.fn().mockResolvedValue(undefined)
const mockGetState = vi.fn().mockReturnValue({
  level: 'guest',
  user: null,
  tokens: {},
  isAuthenticated: false,
})
const mockOnAuthChange = vi.fn().mockReturnValue(() => {})
const mockGetAuthLevel = vi.fn().mockReturnValue('guest')

vi.mock('@/lib/auth/manager', () => ({
  authManager: {
    isConnected: (...args: unknown[]) => mockIsConnected(...args),
    disconnect: (...args: unknown[]) => mockDisconnect(...args),
    getState: () => mockGetState(),
    onAuthChange: (...args: unknown[]) => mockOnAuthChange(...args),
    getAuthLevel: () => mockGetAuthLevel(),
  },
}))

// Mock the provider registry
const mockGetDefaultProvider = vi.fn().mockReturnValue(undefined)
const mockListProviders = vi.fn().mockReturnValue([])

vi.mock('@/lib/llm/provider-registry', () => ({
  providerRegistry: {
    getDefaultProvider: () => mockGetDefaultProvider(),
    listProviders: () => mockListProviders(),
    setDefaultProvider: vi.fn(),
  },
}))

// Import the module — this triggers createFileRoute and captures the component
await import('../settings')

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Activate a Radix tab in jsdom. Radix uses onPointerDown + onKeyDown on the
 * RovingFocusGroup, so a plain fireEvent.click is not enough. We dispatch
 * pointer/mouse/focus events that Radix listens for.
 */
function activateTab(name: RegExp) {
  const tab = screen.getByRole('tab', { name })
  // Radix Tabs uses pointer-down on the trigger to activate
  fireEvent.pointerDown(tab, { button: 0, pointerType: 'mouse' })
  fireEvent.mouseDown(tab, { button: 0 })
  fireEvent.click(tab)
  fireEvent.focus(tab)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetState.mockReturnValue({
      level: 'guest',
      user: null,
      tokens: {},
      isAuthenticated: false,
    })
    mockIsConnected.mockReturnValue(false)
    mockGetDefaultProvider.mockReturnValue(undefined)
    mockListProviders.mockReturnValue([])
    // Ensure we start with light mode
    document.documentElement.classList.remove('dark')
  })

  afterEach(() => {
    document.documentElement.classList.remove('dark')
  })

  function renderSettings() {
    if (!CapturedComponent) throw new Error('SettingsPage component not captured')
    return render(createElement(CapturedComponent))
  }

  // -------------------------------------------------------------------------
  // Page header and tabs
  // -------------------------------------------------------------------------

  it('renders the settings page header', () => {
    renderSettings()
    expect(screen.getByText('Settings')).toBeInTheDocument()
    expect(screen.getByText('Authentication, LLM provider configuration, and preferences.')).toBeInTheDocument()
  })

  it('renders all tab triggers', () => {
    renderSettings()
    expect(screen.getByRole('tab', { name: /integrations/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /preferences/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /about/i })).toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // Auth connections section (default tab)
  // -------------------------------------------------------------------------

  describe('Auth Connections', () => {
    it('renders the auth connection section with all four providers', () => {
      renderSettings()

      expect(screen.getByText('Auth Connections')).toBeInTheDocument()
      expect(screen.getByText('GitHub')).toBeInTheDocument()
      expect(screen.getByText('Atlassian')).toBeInTheDocument()
      expect(screen.getByText('Red Hat SSO')).toBeInTheDocument()
      expect(screen.getByText('Google')).toBeInTheDocument()
    })

    it('shows "Disconnected" badge when providers are not connected', () => {
      mockIsConnected.mockReturnValue(false)
      renderSettings()

      const badges = screen.getAllByText('Disconnected')
      expect(badges.length).toBe(4)
    })

    it('shows "Connected" badge when a provider is connected', () => {
      mockIsConnected.mockImplementation((provider: string) => provider === 'github')
      mockGetState.mockReturnValue({
        level: 'github',
        user: null,
        tokens: {
          github: {
            accessToken: 'test',
            expiresAt: Date.now() + 3600_000,
            provider: 'github',
          },
        },
        isAuthenticated: true,
      })

      renderSettings()

      expect(screen.getByText('Connected')).toBeInTheDocument()
      expect(screen.getAllByText('Disconnected')).toHaveLength(3)
    })

    it('shows Disconnect button for connected providers', () => {
      mockIsConnected.mockImplementation((provider: string) => provider === 'github')
      mockGetState.mockReturnValue({
        level: 'github',
        user: null,
        tokens: {
          github: {
            accessToken: 'test',
            expiresAt: Date.now() + 3600_000,
            provider: 'github',
          },
        },
        isAuthenticated: true,
      })

      renderSettings()

      expect(screen.getByText('Disconnect')).toBeInTheDocument()
    })
  })

  // -------------------------------------------------------------------------
  // LLM Provider section
  // -------------------------------------------------------------------------

  describe('LLM Provider', () => {
    it('renders the LLM provider section in the integrations tab', () => {
      renderSettings()

      // Integrations is the default tab, so LLM Provider should be visible
      expect(screen.getByText('LLM Provider')).toBeInTheDocument()
      expect(screen.getByText('Configure the AI model used for chat assistance.')).toBeInTheDocument()
    })

    it('shows empty state when no LLM provider is registered', () => {
      mockGetDefaultProvider.mockReturnValue(undefined)
      renderSettings()

      expect(screen.getByText(/no ai provider configured/i)).toBeInTheDocument()
    })

    it('displays active provider with capability badges', () => {
      mockGetDefaultProvider.mockReturnValue({
        id: 'anthropic',
        name: 'Anthropic',
        models: [{ id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', contextWindow: 200000, supportsToolUse: true }],
        supportsToolUse: true,
        supportsStreaming: true,
        maxContextWindow: 200000,
      })

      renderSettings()

      expect(screen.getByText('Anthropic')).toBeInTheDocument()
      expect(screen.getByText('Tool Use')).toBeInTheDocument()
      expect(screen.getByText('Streaming')).toBeInTheDocument()
    })
  })

  // -------------------------------------------------------------------------
  // Theme toggle
  // -------------------------------------------------------------------------

  describe('Theme Toggle', () => {
    it('renders the theme toggle in the preferences tab', () => {
      renderSettings()

      activateTab(/preferences/i)

      expect(screen.getByText('Theme')).toBeInTheDocument()
      expect(screen.getByLabelText('Toggle theme')).toBeInTheDocument()
    })

    it('toggles between light and dark mode', () => {
      renderSettings()

      activateTab(/preferences/i)

      const toggleButton = screen.getByLabelText('Toggle theme')

      // Initially light mode — button should say "Dark"
      expect(screen.getByText('Dark')).toBeInTheDocument()

      fireEvent.click(toggleButton)

      // Now dark mode — button should say "Light"
      expect(screen.getByText('Light')).toBeInTheDocument()
      expect(document.documentElement.classList.contains('dark')).toBe(true)

      fireEvent.click(toggleButton)

      expect(screen.getByText('Dark')).toBeInTheDocument()
      expect(document.documentElement.classList.contains('dark')).toBe(false)
    })
  })
})
