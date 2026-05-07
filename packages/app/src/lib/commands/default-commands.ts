/**
 * Default commands registered with the global command palette.
 *
 * Call `registerDefaultCommands(navigate)` once at app startup
 * (typically from the root layout) to populate the registry with
 * navigation, action, and dynamic issue commands.
 */

import type { PersonaRole } from '@/stores/persona'
import { PERSONA_LABELS, usePersonaStore } from '@/stores/persona'
import { useSidebarStore } from '@/stores/sidebar'
import { useThemeStore } from '@/stores/theme'
import { commandRegistry } from './registry'
import type { Command } from './types'

// ---------------------------------------------------------------------------
// Types for the navigate callback
// ---------------------------------------------------------------------------

type NavigateFn = (opts: { to: string; params?: Record<string, string> }) => void

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

/**
 * Register all built-in commands. Returns a dispose function that
 * unregisters them (useful for HMR / tests).
 */
export function registerDefaultCommands(navigate: NavigateFn): () => void {
  const disposers: Array<() => void> = []

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
      action: () => navigate({ to: '/board' }),
    },
    {
      id: 'nav.go-to-chat',
      label: 'Go to Chat',
      description: 'Navigate to general chat',
      category: 'navigation',
      keywords: ['chat', 'ai', 'conversation', 'message'],
      shortcut: '⌘3',
      action: () => navigate({ to: '/chat' }),
    },
    {
      id: 'nav.go-to-search',
      label: 'Search Issues',
      description: 'Navigate to issue search',
      category: 'navigation',
      keywords: ['search', 'find', 'jira', 'issues', 'query'],
      action: () => navigate({ to: '/search' }),
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
  ]

  for (const cmd of navCommands) {
    disposers.push(commandRegistry.register(cmd))
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
        useThemeStore.getState().toggle()
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
        useSidebarStore.getState().toggleSidebar()
      },
    },
  ]

  for (const cmd of actionCommands) {
    disposers.push(commandRegistry.register(cmd))
  }

  // -- Persona switch commands -----------------------------------------------

  const personaRoles = Object.entries(PERSONA_LABELS) as [PersonaRole, string][]
  for (const [roleId, roleLabel] of personaRoles) {
    disposers.push(
      commandRegistry.register({
        id: `action.switch-to-${roleId}`,
        label: `Switch to ${roleLabel}`,
        description: `Set your role to ${roleLabel}`,
        category: 'action',
        keywords: ['role', 'persona', 'switch', roleId, roleLabel.toLowerCase()],
        action: () => {
          usePersonaStore.getState().setRole(roleId)
        },
      }),
    )
  }

  return () => {
    for (const dispose of disposers) {
      dispose()
    }
  }
}

/**
 * Register dynamic issue commands from a list of issues.
 * Returns a dispose function to unregister them.
 */
export function registerIssueCommands(
  issues: Array<{ key: string; summary: string }>,
  navigate: NavigateFn,
): () => void {
  const disposers: Array<() => void> = []

  for (const issue of issues) {
    disposers.push(
      commandRegistry.register({
        id: `issue.open-${issue.key}`,
        label: `Open ${issue.key}: ${issue.summary}`,
        category: 'issue',
        keywords: [issue.key, issue.summary],
        action: () => navigate({ to: '/issue/$issueKey/chat', params: { issueKey: issue.key } }),
      }),
    )
  }

  return () => {
    for (const dispose of disposers) {
      dispose()
    }
  }
}
