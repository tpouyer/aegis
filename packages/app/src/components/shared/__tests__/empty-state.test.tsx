import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EmptyState, type EmptyStateVariant } from '../EmptyState'

// ---------------------------------------------------------------------------
// EmptyState component tests
// ---------------------------------------------------------------------------

describe('EmptyState', () => {
  it('renders with title and description', () => {
    render(
      <EmptyState
        title="No items found"
        description="Try changing your filters."
      />,
    )

    expect(screen.getByText('No items found')).toBeInTheDocument()
    expect(screen.getByText('Try changing your filters.')).toBeInTheDocument()
  })

  it('renders CTA button when action is provided', async () => {
    const handleClick = vi.fn()
    const user = userEvent.setup()

    render(
      <EmptyState
        title="Connect required"
        action={{ label: 'Connect Now', onClick: handleClick }}
      />,
    )

    const button = screen.getByRole('button', { name: 'Connect Now' })
    expect(button).toBeInTheDocument()

    await user.click(button)
    expect(handleClick).toHaveBeenCalledOnce()
  })

  it('does not render CTA button when no action is provided', () => {
    render(<EmptyState title="Just info" />)

    // The only element should be the status container; no button rendered
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('renders correct icon for each variant', () => {
    const variants: EmptyStateVariant[] = [
      'info',
      'auth-required',
      'no-data',
      'error',
    ]

    for (const variant of variants) {
      const { container, unmount } = render(
        <EmptyState variant={variant} title={`${variant} state`} />,
      )

      // Each variant renders an SVG icon inside the card
      const svg = container.querySelector('svg')
      expect(svg).toBeInTheDocument()

      unmount()
    }
  })

  it('applies aria-label from the title', () => {
    render(<EmptyState title="Authentication required" />)

    const status = screen.getByRole('status')
    expect(status).toHaveAttribute('aria-label', 'Authentication required')
  })

  it('renders children content', () => {
    render(
      <EmptyState title="With children">
        <p>Extra content below</p>
      </EmptyState>,
    )

    expect(screen.getByText('Extra content below')).toBeInTheDocument()
  })

  it('applies custom className', () => {
    const { container } = render(
      <EmptyState title="Custom class" className="my-custom-class" />,
    )

    // The Card wrapper should have the custom class
    const card = container.firstChild as HTMLElement
    expect(card.className).toContain('my-custom-class')
  })
})

// ---------------------------------------------------------------------------
// Board empty state — auth prompt when not authenticated
// ---------------------------------------------------------------------------

describe('Board empty state', () => {
  it('shows auth prompt when not authenticated', () => {
    const handleConnect = vi.fn()

    render(
      <EmptyState
        variant="auth-required"
        title="Connect to Jira to see your boards"
        description="Link your Atlassian account to load boards, view issues, and transition cards with drag-and-drop."
        action={{ label: 'Connect to Jira', onClick: handleConnect }}
      />,
    )

    expect(
      screen.getByText('Connect to Jira to see your boards'),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'Link your Atlassian account to load boards, view issues, and transition cards with drag-and-drop.',
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Connect to Jira' }),
    ).toBeInTheDocument()
  })

  it('shows no-data state when filters produce no results', async () => {
    const handleClearFilters = vi.fn()
    const user = userEvent.setup()

    render(
      <EmptyState
        variant="no-data"
        title="No issues match your filters"
        description="Try adjusting or clearing your filters to see more issues on this board."
        action={{
          label: 'Clear Filters',
          onClick: handleClearFilters,
          variant: 'outline',
        }}
      />,
    )

    expect(
      screen.getByText('No issues match your filters'),
    ).toBeInTheDocument()

    const clearButton = screen.getByRole('button', { name: 'Clear Filters' })
    await user.click(clearButton)
    expect(handleClearFilters).toHaveBeenCalledOnce()
  })
})

// ---------------------------------------------------------------------------
// Chat empty state — suggested prompts
// ---------------------------------------------------------------------------

describe('Chat empty state', () => {
  it('shows suggested prompts that the user can click', async () => {
    const handleSend = vi.fn()
    const user = userEvent.setup()

    const prompts = [
      'What are the acceptance criteria for this issue?',
      'Suggest an implementation approach for this issue',
      'What files in the codebase are most relevant?',
      'Are there any potential edge cases I should consider?',
    ]

    render(
      <EmptyState
        variant="info"
        title="Start a conversation about AEGIS-42"
        description="Ask the AI assistant about implementation approaches, coding standards, or anything related to this issue."
      >
        <div className="mt-2 w-full space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            Suggested prompts
          </p>
          <ul className="space-y-1.5" role="list" aria-label="Suggested prompts">
            {prompts.map((prompt) => (
              <li key={prompt}>
                <button
                  type="button"
                  className="w-full rounded-md border border-border px-3 py-2 text-left text-sm"
                  onClick={() => handleSend(prompt)}
                >
                  {prompt}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </EmptyState>,
    )

    // Title is rendered
    expect(
      screen.getByText('Start a conversation about AEGIS-42'),
    ).toBeInTheDocument()

    // All suggested prompts are visible
    for (const prompt of prompts) {
      expect(screen.getByText(prompt)).toBeInTheDocument()
    }

    // Clicking a prompt fires the callback with the prompt text
    await user.click(screen.getByText(prompts[0]))
    expect(handleSend).toHaveBeenCalledWith(prompts[0])

    await user.click(screen.getByText(prompts[2]))
    expect(handleSend).toHaveBeenCalledWith(prompts[2])
    expect(handleSend).toHaveBeenCalledTimes(2)
  })

  it('renders the suggested prompts list with accessible role', () => {
    render(
      <EmptyState variant="info" title="Start a conversation about AEGIS-1">
        <ul role="list" aria-label="Suggested prompts">
          <li>
            <button type="button">Prompt 1</button>
          </li>
        </ul>
      </EmptyState>,
    )

    const list = screen.getByRole('list', { name: 'Suggested prompts' })
    expect(list).toBeInTheDocument()
  })
})
