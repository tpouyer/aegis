import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CommandPalette } from '../CommandPalette';
import { commandRegistry } from '@/lib/commands/registry';

// ---------------------------------------------------------------------------
// jsdom polyfills
// ---------------------------------------------------------------------------

// ResizeObserver is not available in jsdom
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof globalThis.ResizeObserver;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function registerTestCommands() {
  const disposers: Array<() => void> = [];

  disposers.push(
    commandRegistry.register({
      id: 'nav.home',
      label: 'Go to Home',
      category: 'navigation',
      action: vi.fn(),
    }),
  );

  disposers.push(
    commandRegistry.register({
      id: 'nav.settings',
      label: 'Go to Settings',
      category: 'navigation',
      action: vi.fn(),
      shortcut: '⌘,',
    }),
  );

  disposers.push(
    commandRegistry.register({
      id: 'action.theme',
      label: 'Toggle Theme',
      category: 'action',
      action: vi.fn(),
    }),
  );

  disposers.push(
    commandRegistry.register({
      id: 'file.readme',
      label: 'Open README.md',
      category: 'file',
      action: vi.fn(),
    }),
  );

  return () => disposers.forEach((d) => d());
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CommandPalette', () => {
  let dispose: () => void;

  beforeEach(() => {
    dispose = registerTestCommands();
  });

  afterEach(() => {
    dispose();
  });

  // -----------------------------------------------------------------------
  // Open / close
  // -----------------------------------------------------------------------

  it('renders nothing when closed', () => {
    const { container } = render(
      <CommandPalette open={false} onOpenChange={() => {}} />,
    );

    expect(container.querySelector('[role="listbox"]')).not.toBeInTheDocument();
  });

  it('renders the palette when open', () => {
    render(<CommandPalette open={true} onOpenChange={() => {}} />);

    expect(screen.getByLabelText('Command search')).toBeInTheDocument();
    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });

  it('shows all commands when opened with no query', () => {
    render(<CommandPalette open={true} onOpenChange={() => {}} />);

    expect(screen.getByText('Go to Home')).toBeInTheDocument();
    expect(screen.getByText('Go to Settings')).toBeInTheDocument();
    expect(screen.getByText('Toggle Theme')).toBeInTheDocument();
    expect(screen.getByText('Open README.md')).toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // Filtering
  // -----------------------------------------------------------------------

  it('typing filters commands by label', async () => {
    const user = userEvent.setup();
    render(<CommandPalette open={true} onOpenChange={() => {}} />);

    const input = screen.getByLabelText('Command search');
    await user.type(input, 'Settings');

    expect(screen.getByText('Go to Settings')).toBeInTheDocument();
    expect(screen.queryByText('Toggle Theme')).not.toBeInTheDocument();
  });

  it('shows "No commands found" when nothing matches', async () => {
    const user = userEvent.setup();
    render(<CommandPalette open={true} onOpenChange={() => {}} />);

    const input = screen.getByLabelText('Command search');
    await user.type(input, 'xyznonexistent');

    expect(screen.getByText('No commands found.')).toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // Keyboard navigation
  // -----------------------------------------------------------------------

  it('arrow keys navigate the list', async () => {
    const user = userEvent.setup();
    render(<CommandPalette open={true} onOpenChange={() => {}} />);

    const input = screen.getByLabelText('Command search');

    // First item should be selected by default
    const options = screen.getAllByRole('option');
    expect(options[0]).toHaveAttribute('aria-selected', 'true');

    // Press ArrowDown to select the second item
    await user.keyboard('{ArrowDown}');
    const updatedOptions = screen.getAllByRole('option');
    expect(updatedOptions[1]).toHaveAttribute('aria-selected', 'true');
    expect(updatedOptions[0]).toHaveAttribute('aria-selected', 'false');
  });

  it('arrow up wraps to bottom', async () => {
    const user = userEvent.setup();
    render(<CommandPalette open={true} onOpenChange={() => {}} />);

    // Press ArrowUp from the first item wraps to the last
    await user.keyboard('{ArrowUp}');

    const options = screen.getAllByRole('option');
    const lastOption = options[options.length - 1];
    expect(lastOption).toHaveAttribute('aria-selected', 'true');
  });

  it('Enter executes the selected command', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    render(<CommandPalette open={true} onOpenChange={onOpenChange} />);

    // The first command in the list should be selected
    await user.keyboard('{Enter}');

    // The first registered nav command's action should have been called
    const homeCmd = commandRegistry.getAll('navigation')[0];
    expect(homeCmd.action).toHaveBeenCalled();

    // Dialog should close
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('Escape closes the palette', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    render(<CommandPalette open={true} onOpenChange={onOpenChange} />);

    await user.keyboard('{Escape}');

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  // -----------------------------------------------------------------------
  // Click to execute
  // -----------------------------------------------------------------------

  it('clicking a command executes it and closes the palette', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    render(<CommandPalette open={true} onOpenChange={onOpenChange} />);

    const themeButton = screen.getByText('Toggle Theme');
    await user.click(themeButton);

    const themeCmd = commandRegistry.getAll('action').find((c) => c.id === 'action.theme');
    expect(themeCmd?.action).toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  // -----------------------------------------------------------------------
  // Shortcut display
  // -----------------------------------------------------------------------

  it('shows shortcut hints for commands that have them', () => {
    render(<CommandPalette open={true} onOpenChange={() => {}} />);

    expect(screen.getByText('⌘,')).toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // Category group headers
  // -----------------------------------------------------------------------

  it('shows category group headers', () => {
    render(<CommandPalette open={true} onOpenChange={() => {}} />);

    expect(screen.getByText('Navigation')).toBeInTheDocument();
    expect(screen.getByText('Actions')).toBeInTheDocument();
    expect(screen.getByText('Files')).toBeInTheDocument();
  });
});
