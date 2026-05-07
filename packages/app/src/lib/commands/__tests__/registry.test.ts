import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CommandRegistry } from '../registry'
import type { Command } from '../types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCommand(overrides: Partial<Command> & { id: string; label: string }): Command {
  return {
    category: 'action',
    action: () => {},
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CommandRegistry', () => {
  let registry: CommandRegistry

  beforeEach(() => {
    registry = new CommandRegistry()
  })

  // -----------------------------------------------------------------------
  // Registration and basic search
  // -----------------------------------------------------------------------

  it('registers and finds a command by label', () => {
    registry.register(makeCommand({ id: 'test', label: 'Go to Home' }))

    const results = registry.search('Home')
    expect(results).toHaveLength(1)
    expect(results[0].id).toBe('test')
  })

  it('returns a dispose function that unregisters the command', () => {
    const dispose = registry.register(makeCommand({ id: 'disposable', label: 'Temporary Command' }))

    expect(registry.search('Temporary')).toHaveLength(1)

    dispose()

    expect(registry.search('Temporary')).toHaveLength(0)
  })

  // -----------------------------------------------------------------------
  // Fuzzy search
  // -----------------------------------------------------------------------

  it('fuzzy search matches partial words', () => {
    registry.register(makeCommand({ id: 'a', label: 'Toggle Theme' }))
    registry.register(makeCommand({ id: 'b', label: 'Toggle Sidebar' }))

    const results = registry.search('tog')
    expect(results).toHaveLength(2)
  })

  it('fuzzy search matches multiple words across label', () => {
    registry.register(makeCommand({ id: 'a', label: 'Go to Settings' }))
    registry.register(makeCommand({ id: 'b', label: 'Go to Board' }))

    const results = registry.search('go settings')
    expect(results).toHaveLength(1)
    expect(results[0].id).toBe('a')
  })

  it('fuzzy search matches keywords', () => {
    registry.register(
      makeCommand({
        id: 'a',
        label: 'Toggle Theme',
        keywords: ['dark', 'light', 'mode'],
      }),
    )

    const results = registry.search('dark')
    expect(results).toHaveLength(1)
    expect(results[0].id).toBe('a')
  })

  it('search is case-insensitive', () => {
    registry.register(makeCommand({ id: 'a', label: 'Go to Home' }))

    expect(registry.search('GO TO HOME')).toHaveLength(1)
    expect(registry.search('go to home')).toHaveLength(1)
    expect(registry.search('Go To Home')).toHaveLength(1)
  })

  it('empty query returns all visible commands', () => {
    registry.register(makeCommand({ id: 'a', label: 'Alpha' }))
    registry.register(makeCommand({ id: 'b', label: 'Beta' }))
    registry.register(makeCommand({ id: 'c', label: 'Gamma' }))

    const results = registry.search('')
    expect(results).toHaveLength(3)
  })

  it('returns no results when no command matches', () => {
    registry.register(makeCommand({ id: 'a', label: 'Go to Home' }))

    const results = registry.search('zzzzz')
    expect(results).toHaveLength(0)
  })

  // -----------------------------------------------------------------------
  // Category filtering via getAll
  // -----------------------------------------------------------------------

  it('getAll returns all commands when no category specified', () => {
    registry.register(makeCommand({ id: 'a', label: 'Nav', category: 'navigation' }))
    registry.register(makeCommand({ id: 'b', label: 'Act', category: 'action' }))

    expect(registry.getAll()).toHaveLength(2)
  })

  it('getAll filters by category', () => {
    registry.register(makeCommand({ id: 'a', label: 'Nav', category: 'navigation' }))
    registry.register(makeCommand({ id: 'b', label: 'File', category: 'file' }))
    registry.register(makeCommand({ id: 'c', label: 'Act', category: 'action' }))

    expect(registry.getAll('file')).toHaveLength(1)
    expect(registry.getAll('file')[0].id).toBe('b')
  })

  // -----------------------------------------------------------------------
  // Execute
  // -----------------------------------------------------------------------

  it('execute calls the command action', () => {
    const action = vi.fn()
    registry.register(makeCommand({ id: 'exec-test', label: 'Test', action }))

    registry.execute('exec-test')

    expect(action).toHaveBeenCalledOnce()
  })

  it('execute is a no-op for unknown command id', () => {
    // Should not throw
    registry.execute('nonexistent')
  })

  // -----------------------------------------------------------------------
  // Conditional visibility (when)
  // -----------------------------------------------------------------------

  it('when condition hides commands that return false', () => {
    registry.register(
      makeCommand({
        id: 'hidden',
        label: 'Hidden Command',
        when: () => false,
      }),
    )
    registry.register(
      makeCommand({
        id: 'visible',
        label: 'Visible Command',
        when: () => true,
      }),
    )

    const results = registry.search('Command')
    expect(results).toHaveLength(1)
    expect(results[0].id).toBe('visible')
  })

  it('commands without when are always visible', () => {
    registry.register(makeCommand({ id: 'always', label: 'Always Visible' }))

    expect(registry.search('Always')).toHaveLength(1)
    expect(registry.getAll()).toHaveLength(1)
  })

  it('when condition hides commands from getAll', () => {
    registry.register(makeCommand({ id: 'h', label: 'Hidden', category: 'action', when: () => false }))

    expect(registry.getAll('action')).toHaveLength(0)
  })

  // -----------------------------------------------------------------------
  // Relevance sorting
  // -----------------------------------------------------------------------

  it('results sorted by relevance — prefix match ranks higher than substring', () => {
    registry.register(makeCommand({ id: 'sub', label: 'My Settings Page' }))
    registry.register(makeCommand({ id: 'prefix', label: 'Settings' }))

    const results = registry.search('Settings')

    // "Settings" (prefix match on label) should come before "My Settings Page" (substring)
    expect(results[0].id).toBe('prefix')
    expect(results[1].id).toBe('sub')
  })

  it('label match ranks higher than keyword match', () => {
    registry.register(
      makeCommand({
        id: 'kw',
        label: 'Toggle Mode',
        keywords: ['theme'],
      }),
    )
    registry.register(
      makeCommand({
        id: 'label',
        label: 'Change Theme',
      }),
    )

    const results = registry.search('theme')

    // "Change Theme" (label match) should rank above "Toggle Mode" (keyword match)
    expect(results[0].id).toBe('label')
    expect(results[1].id).toBe('kw')
  })
})
