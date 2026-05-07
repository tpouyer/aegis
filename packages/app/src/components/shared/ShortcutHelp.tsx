/**
 * ShortcutHelp — modal overlay listing all registered keyboard shortcuts.
 *
 * Triggered by pressing `?` (registered as a global shortcut in the
 * root layout). Groups shortcuts by scope and renders key combos
 * with platform-correct modifier symbols.
 */

import { useCallback, useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { Shortcut } from '@/lib/shortcuts'
import { isMac, parseKeyDescriptor, shortcutRegistry } from '@/lib/shortcuts'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SCOPE_LABELS: Record<string, string> = {
  global: 'Global',
  board: 'Board',
  chat: 'Chat',
  ide: 'IDE',
}

const SCOPE_ORDER: string[] = ['global', 'board', 'chat', 'ide']

/**
 * Render a key descriptor as a user-facing string with platform-correct
 * modifier (Command on Mac, Ctrl on Windows/Linux).
 */
function formatKey(key: string): string {
  // Chord: "g b" -> "G then B"
  if (key.includes(' ')) {
    return key
      .split(' ')
      .map((k) => formatSingleKey(k))
      .join(' then ')
  }
  return formatSingleKey(key)
}

function formatSingleKey(descriptor: string): string {
  const parsed = parseKeyDescriptor(descriptor)
  const parts: string[] = []

  if (parsed.mod) {
    parts.push(isMac ? '⌘' : 'Ctrl')
  }
  if (parsed.shift) {
    parts.push(isMac ? '⇧' : 'Shift')
  }
  if (parsed.alt) {
    parts.push(isMac ? '⌥' : 'Alt')
  }

  // Capitalise the key name for display
  const keyName = parsed.key.length === 1 ? parsed.key.toUpperCase() : capitalise(parsed.key)
  parts.push(keyName)

  return parts.join(isMac ? '' : '+')
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ShortcutHelp() {
  const [open, setOpen] = useState(false)

  // Register the `?` shortcut to open this overlay
  useEffect(() => {
    const unregister = shortcutRegistry.register({
      key: '?',
      scope: 'global',
      description: 'Show keyboard shortcuts',
      action: () => setOpen(true),
    })
    return unregister
  }, [])

  const handleOpenChange = useCallback((value: boolean) => {
    setOpen(value)
  }, [])

  // Group shortcuts by scope
  const allShortcuts = shortcutRegistry.getShortcuts()
  const grouped = new Map<string, Shortcut[]>()

  for (const shortcut of allShortcuts) {
    // Skip the "?" shortcut itself from the listing to avoid redundancy
    const existing = grouped.get(shortcut.scope) ?? []
    existing.push(shortcut)
    grouped.set(shortcut.scope, existing)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
          <DialogDescription>
            Press <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-xs font-mono">?</kbd> anytime
            to show this reference.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {SCOPE_ORDER.map((scope) => {
            const shortcuts = grouped.get(scope)
            if (!shortcuts || shortcuts.length === 0) return null

            return (
              <div key={scope}>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {SCOPE_LABELS[scope] ?? scope}
                </h3>
                <ul className="space-y-1">
                  {shortcuts.map((shortcut, idx) => (
                    <li
                      key={`${shortcut.key}-${idx}`}
                      className="flex items-center justify-between rounded px-2 py-1.5 text-sm hover:bg-accent/50"
                    >
                      <span className="text-foreground">{shortcut.description}</span>
                      <kbd className="ml-4 shrink-0 rounded border border-border bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground">
                        {formatKey(shortcut.key)}
                      </kbd>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      </DialogContent>
    </Dialog>
  )
}
