import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
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

// Mock the recent store
const mockRecentIssues = vi.fn().mockReturnValue([])

vi.mock('@/stores/recent', () => ({
  useRecentStore: (selector: (s: { issues: unknown[] }) => unknown) =>
    selector({ issues: mockRecentIssues() }),
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
    mockRecentIssues.mockReturnValue([])
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  function renderLanding() {
    if (!CapturedComponent) throw new Error('HomePage component not captured')
    return render(createElement(CapturedComponent))
  }

  // -------------------------------------------------------------------------
  // Unauthenticated — Hero section
  // -------------------------------------------------------------------------

  describe('Hero Section (unauthenticated)', () => {
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
  // Feature cards (About section)
  // -------------------------------------------------------------------------

  describe('Feature Cards', () => {
    it('renders three feature cards when About section is expanded', () => {
      renderLanding()

      // For unauthenticated users, About section is expanded by default
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

    it('can toggle About section', () => {
      renderLanding()

      const aboutButton = screen.getByText('About Aegis')
      expect(screen.getByText('Kanban Board')).toBeInTheDocument()

      // Collapse
      fireEvent.click(aboutButton)
      expect(screen.queryByText('Kanban Board')).not.toBeInTheDocument()

      // Expand
      fireEvent.click(aboutButton)
      expect(screen.getByText('Kanban Board')).toBeInTheDocument()
    })
  })

  // -------------------------------------------------------------------------
  // Quick start section (unauthenticated)
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

      expect(screen.getByText(/Welcome back/)).toBeInTheDocument()
      expect(screen.getByText('Contributor')).toBeInTheDocument()
      expect(screen.getByText(/Test User/)).toBeInTheDocument()
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

    it('shows quick actions when authenticated', () => {
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

      expect(screen.getByText('Open Board')).toBeInTheDocument()
      expect(screen.getByText('Configure AI')).toBeInTheDocument()
      expect(screen.getByText('Settings')).toBeInTheDocument()
    })
  })

  // -------------------------------------------------------------------------
  // Recent issues
  // -------------------------------------------------------------------------

  describe('Recent Issues', () => {
    it('shows recent issues grid when issues exist', () => {
      mockGetState.mockReturnValue({
        level: 'github',
        user: { displayName: 'Dev', authLevel: 'github', connectedProviders: ['github'] },
        tokens: { github: { accessToken: 'x', expiresAt: Date.now() + 3600_000, provider: 'github' } },
        isAuthenticated: true,
      })
      mockRecentIssues.mockReturnValue([
        { key: 'PROJ-123', summary: 'Fix login bug', lastVisited: Date.now(), lastView: 'chat' },
        { key: 'PROJ-456', summary: 'Add dark mode', lastVisited: Date.now() - 1000, lastView: 'ide' },
      ])

      renderLanding()

      expect(screen.getByText('Recent Issues')).toBeInTheDocument()
      expect(screen.getByText('PROJ-123')).toBeInTheDocument()
      expect(screen.getByText('Fix login bug')).toBeInTheDocument()
      expect(screen.getByText('PROJ-456')).toBeInTheDocument()
      expect(screen.getByText('Add dark mode')).toBeInTheDocument()
    })

    it('does not show recent issues section when empty', () => {
      mockGetState.mockReturnValue({
        level: 'github',
        user: null,
        tokens: { github: { accessToken: 'x', expiresAt: Date.now() + 3600_000, provider: 'github' } },
        isAuthenticated: true,
      })
      mockRecentIssues.mockReturnValue([])

      renderLanding()

      expect(screen.queryByText('Recent Issues')).not.toBeInTheDocument()
    })

    it('shows Chat action for chat-viewed issues', () => {
      mockGetState.mockReturnValue({
        level: 'github',
        user: null,
        tokens: { github: { accessToken: 'x', expiresAt: Date.now() + 3600_000, provider: 'github' } },
        isAuthenticated: true,
      })
      mockRecentIssues.mockReturnValue([
        { key: 'PROJ-1', summary: 'Test', lastVisited: Date.now(), lastView: 'chat' },
      ])

      renderLanding()

      expect(screen.getByText('Chat')).toBeInTheDocument()
    })

    it('shows IDE action for ide-viewed issues', () => {
      mockGetState.mockReturnValue({
        level: 'github',
        user: null,
        tokens: { github: { accessToken: 'x', expiresAt: Date.now() + 3600_000, provider: 'github' } },
        isAuthenticated: true,
      })
      mockRecentIssues.mockReturnValue([
        { key: 'PROJ-2', summary: 'Test', lastVisited: Date.now(), lastView: 'ide' },
      ])

      renderLanding()

      expect(screen.getByText('IDE')).toBeInTheDocument()
    })

    it('collapses About section by default when recent issues exist', () => {
      mockGetState.mockReturnValue({
        level: 'github',
        user: null,
        tokens: { github: { accessToken: 'x', expiresAt: Date.now() + 3600_000, provider: 'github' } },
        isAuthenticated: true,
      })
      mockRecentIssues.mockReturnValue([
        { key: 'PROJ-1', summary: 'Test', lastVisited: Date.now(), lastView: 'chat' },
      ])

      renderLanding()

      // About section collapsed — feature cards should NOT be visible
      expect(screen.queryByText('Kanban Board')).not.toBeInTheDocument()
      // The toggle button should still be there
      expect(screen.getByText('About Aegis')).toBeInTheDocument()
    })

    it('expands About section by default when no recent issues', () => {
      mockGetState.mockReturnValue({
        level: 'github',
        user: null,
        tokens: { github: { accessToken: 'x', expiresAt: Date.now() + 3600_000, provider: 'github' } },
        isAuthenticated: true,
      })
      mockRecentIssues.mockReturnValue([])

      renderLanding()

      // About section expanded — feature cards should be visible
      expect(screen.getByText('Kanban Board')).toBeInTheDocument()
    })
  })
})
