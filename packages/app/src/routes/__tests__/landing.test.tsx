import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { createElement } from 'react'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

let CapturedComponent: React.ComponentType | undefined

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (opts: { component: React.ComponentType }) => {
    CapturedComponent = opts.component
    return { component: opts.component }
  },
  Link: ({ children, ...props }: { children: React.ReactNode; to?: string }) => (
    <a href={props.to ?? '#'} {...props}>
      {children}
    </a>
  ),
}))

vi.mock('@/lib/auth/sw-bridge', () => ({
  sendTokenToSW: vi.fn().mockResolvedValue(undefined),
  clearTokenInSW: vi.fn().mockResolvedValue(undefined),
}))

const mockGetState = vi.fn().mockReturnValue({
  level: 'guest',
  user: null,
  tokens: {},
  isAuthenticated: false,
})
const mockOnAuthChange = vi.fn().mockReturnValue(() => {})
const mockIsConnected = vi.fn().mockReturnValue(false)
const mockGetAuthLevel = vi.fn().mockReturnValue('guest')

vi.mock('@/lib/auth/manager', () => ({
  authManager: {
    getState: () => mockGetState(),
    onAuthChange: (...args: unknown[]) => mockOnAuthChange(...args),
    isConnected: (...args: unknown[]) => mockIsConnected(...args),
    getAuthLevel: () => mockGetAuthLevel(),
  },
}))

// Import the module to capture the component
await import('../index')

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Landing Page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetState.mockReturnValue({
      level: 'guest',
      user: null,
      tokens: {},
      isAuthenticated: false,
    })
    mockIsConnected.mockReturnValue(false)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  function renderLanding() {
    if (!CapturedComponent) throw new Error('HomePage component not captured')
    return render(createElement(CapturedComponent))
  }

  // -------------------------------------------------------------------------
  // Hero section
  // -------------------------------------------------------------------------

  describe('Hero Section', () => {
    it('renders "Aegis" title', () => {
      renderLanding()
      expect(screen.getByText('Aegis')).toBeInTheDocument()
    })

    it('renders the tagline', () => {
      renderLanding()
      expect(
        screen.getByText('Guard your workflow, ship with confidence.'),
      ).toBeInTheDocument()
    })

    it('renders "Zero-infrastructure development platform"', () => {
      renderLanding()
      expect(
        screen.getByText('Zero-infrastructure development platform'),
      ).toBeInTheDocument()
    })
  })

  // -------------------------------------------------------------------------
  // Feature cards
  // -------------------------------------------------------------------------

  describe('Feature Cards', () => {
    it('renders three feature cards', () => {
      renderLanding()

      expect(screen.getByText('Kanban Board')).toBeInTheDocument()
      expect(screen.getByText('AI Chat')).toBeInTheDocument()
      expect(screen.getByText('Web IDE')).toBeInTheDocument()
    })

    it('shows feature descriptions', () => {
      renderLanding()

      expect(
        screen.getByText('Jira-backed boards with drag-and-drop transitions'),
      ).toBeInTheDocument()
      expect(
        screen.getByText("Context-aware AI with your team's conventions"),
      ).toBeInTheDocument()
      expect(
        screen.getByText('Browser-based editing with branch management'),
      ).toBeInTheDocument()
    })
  })

  // -------------------------------------------------------------------------
  // Quick start section
  // -------------------------------------------------------------------------

  describe('Quick Start Section', () => {
    it('renders auth buttons when not authenticated', () => {
      renderLanding()

      expect(screen.getByText('Guest')).toBeInTheDocument()
      expect(screen.getByText('Contributor')).toBeInTheDocument()
      expect(screen.getByText('Red Hat Employee')).toBeInTheDocument()
    })

    it('renders Browse button for guest path', () => {
      renderLanding()
      expect(screen.getByText('Browse')).toBeInTheDocument()
    })

    it('renders Connect GitHub button', () => {
      renderLanding()
      expect(screen.getByText('Connect GitHub')).toBeInTheDocument()
    })

    it('renders Connect SSO button', () => {
      renderLanding()
      expect(screen.getByText('Connect SSO')).toBeInTheDocument()
    })
  })

  // -------------------------------------------------------------------------
  // Auth status (when authenticated)
  // -------------------------------------------------------------------------

  describe('Auth Status', () => {
    it('shows welcome section when authenticated', () => {
      mockGetState.mockReturnValue({
        level: 'github',
        user: { displayName: 'Test User', authLevel: 'github', connectedProviders: ['github'] },
        tokens: {
          github: {
            accessToken: 'test',
            expiresAt: Date.now() + 3600_000,
            provider: 'github',
          },
        },
        isAuthenticated: true,
      })
      mockIsConnected.mockImplementation((p: string) => p === 'github')

      renderLanding()

      expect(screen.getByText('Welcome back')).toBeInTheDocument()
      expect(screen.getByText('Contributor')).toBeInTheDocument()
      expect(screen.getByText('Test User')).toBeInTheDocument()
    })

    it('does not show quick start when authenticated', () => {
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

      renderLanding()

      expect(screen.queryByText('Get Started')).not.toBeInTheDocument()
    })
  })
})
