/**
 * Default commands registered with the global command palette.
 *
 * Call `registerDefaultCommands(navigate)` once at app startup
 * (typically from the root layout) to populate the registry with
 * navigation, action, and dynamic issue commands.
 */

import { commandRegistry } from './registry';
import type { Command } from './types';

// ---------------------------------------------------------------------------
// Types for the navigate callback
// ---------------------------------------------------------------------------

type NavigateFn = (opts: { to: string; params?: Record<string, string> }) => void;

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

/**
 * Register all built-in commands. Returns a dispose function that
 * unregisters them (useful for HMR / tests).
 */
export function registerDefaultCommands(navigate: NavigateFn): () => void {
  const disposers: Array<() => void> = [];

  // -- Navigation commands --------------------------------------------------

  const navCommands: Command[] = [
    {
      id: 'nav.go-to-home',
      label: 'Go to Home',
      description: 'Navigate to the home page',
      category: 'navigation',
      keywords: ['home', 'landing', 'dashboard'],
      shortcut: '⌘1',
      action: () => navigate({ to: '/' }),
    },
    {
      id: 'nav.go-to-board',
      label: 'Go to Board',
      description: 'Navigate to the kanban board',
      category: 'navigation',
      keywords: ['board', 'kanban', 'issues', 'sprint'],
      shortcut: '⌘2',
      action: () => navigate({ to: '/board/$boardId', params: { boardId: 'default' } }),
    },
    {
      id: 'nav.go-to-settings',
      label: 'Go to Settings',
      description: 'Navigate to settings',
      category: 'navigation',
      keywords: ['settings', 'preferences', 'config', 'configuration'],
      shortcut: '⌘,',
      action: () => navigate({ to: '/settings' }),
    },
  ];

  for (const cmd of navCommands) {
    disposers.push(commandRegistry.register(cmd));
  }

  // -- Action commands ------------------------------------------------------

  const actionCommands: Command[] = [
    {
      id: 'action.toggle-theme',
      label: 'Toggle Theme',
      description: 'Switch between dark and light mode',
      category: 'action',
      keywords: ['theme', 'dark', 'light', 'mode', 'appearance'],
      action: () => {
        const root = document.documentElement;
        root.classList.toggle('dark');
      },
    },
    {
      id: 'action.toggle-sidebar',
      label: 'Toggle Sidebar',
      description: 'Collapse or expand the sidebar',
      category: 'action',
      keywords: ['sidebar', 'panel', 'navigation', 'collapse', 'expand'],
      shortcut: '⌘B',
      action: () => {
        const sidebar = document.querySelector('aside');
        if (sidebar) {
          sidebar.classList.toggle('hidden');
        }
      },
    },
  ];

  for (const cmd of actionCommands) {
    disposers.push(commandRegistry.register(cmd));
  }

  return () => {
    for (const dispose of disposers) {
      dispose();
    }
  };
}

/**
 * Register dynamic issue commands from a list of issues.
 * Returns a dispose function to unregister them.
 */
export function registerIssueCommands(
  issues: Array<{ key: string; summary: string }>,
  navigate: NavigateFn,
): () => void {
  const disposers: Array<() => void> = [];

  for (const issue of issues) {
    disposers.push(
      commandRegistry.register({
        id: `issue.open-${issue.key}`,
        label: `Open ${issue.key}: ${issue.summary}`,
        category: 'issue',
        keywords: [issue.key, issue.summary],
        action: () => navigate({ to: '/board/$boardId', params: { boardId: 'default' } }),
      }),
    );
  }

  return () => {
    for (const dispose of disposers) {
      dispose();
    }
  };
}
