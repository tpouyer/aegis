/**
 * ShortcutRegistry — central registry for context-aware keyboard shortcuts.
 *
 * Shortcuts are scoped (global, board, chat, ide) and only fire when
 * the active scope matches. Supports modifier keys (`mod` maps to
 * Cmd on Mac, Ctrl on Windows/Linux), two-key chord sequences
 * (e.g. `g b`), and conditional enablement via `when` guards.
 *
 * Single-key shortcuts (no modifier) are suppressed when focus is
 * inside an input, textarea, or contenteditable element.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Shortcut {
  /** Key descriptor, e.g. 'k', 'mod+k', 'mod+enter', 'g b' (chord) */
  key: string
  /** Scope in which this shortcut is active */
  scope: 'global' | 'board' | 'chat' | 'ide'
  /** Human-readable description shown in help overlay */
  description: string
  /** Action to execute when the shortcut fires */
  action: () => void
  /** Optional guard — shortcut only fires when this returns true */
  when?: () => boolean
}

interface ParsedKey {
  mod: boolean
  shift: boolean
  alt: boolean
  key: string // normalised to lowercase
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/i.test(navigator.userAgent)

/**
 * Parse a key descriptor like 'mod+shift+k' into structured form.
 */
function parseKeyDescriptor(descriptor: string): ParsedKey {
  const parts = descriptor.toLowerCase().split('+')
  const key = parts[parts.length - 1]
  return {
    mod: parts.includes('mod'),
    shift: parts.includes('shift'),
    alt: parts.includes('alt'),
    key,
  }
}

/**
 * Returns true if the event target is an editable element where
 * single-key shortcuts should be suppressed.
 */
function isEditableTarget(event: KeyboardEvent): boolean {
  const target = event.target as HTMLElement | null
  if (!target) return false
  const tagName = target.tagName?.toLowerCase()
  if (tagName === 'input' || tagName === 'textarea') return true
  if (target.isContentEditable || target.getAttribute?.('contenteditable') === 'true') return true
  return false
}

/**
 * Check whether a KeyboardEvent matches a parsed key descriptor.
 */
function eventMatchesParsedKey(event: KeyboardEvent, parsed: ParsedKey): boolean {
  // Modifier check
  const modKey = isMac ? event.metaKey : event.ctrlKey
  if (parsed.mod && !modKey) return false
  if (!parsed.mod && modKey) return false

  if (parsed.shift && !event.shiftKey) return false
  if (!parsed.shift && event.shiftKey) return false

  if (parsed.alt && !event.altKey) return false
  if (!parsed.alt && event.altKey) return false

  // Key check (normalise)
  return event.key.toLowerCase() === parsed.key
}

/**
 * Returns true when a key descriptor has modifiers (mod, shift, alt).
 */
function hasModifiers(parsed: ParsedKey): boolean {
  return parsed.mod || parsed.shift || parsed.alt
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

const CHORD_TIMEOUT_MS = 1000

class ShortcutRegistry {
  private shortcuts: Map<string, Shortcut> = new Map()
  private nextId = 0

  // Chord state: the first key of a pending chord sequence
  private pendingChordKey: string | null = null
  private chordTimer: ReturnType<typeof setTimeout> | null = null

  /**
   * Register a shortcut. Returns an unregister function.
   */
  register(shortcut: Shortcut): () => void {
    const id = String(this.nextId++)
    this.shortcuts.set(id, shortcut)
    return () => {
      this.shortcuts.delete(id)
    }
  }

  /**
   * Get all registered shortcuts, optionally filtered by scope.
   */
  getShortcuts(scope?: string): Shortcut[] {
    const all = Array.from(this.shortcuts.values())
    if (!scope) return all
    return all.filter((s) => s.scope === scope)
  }

  /**
   * Handle a keydown event for the given active scope.
   * Returns `true` if a shortcut matched and was executed.
   */
  handleKeyDown(event: KeyboardEvent, activeScope: string): boolean {
    const editable = isEditableTarget(event)

    // ------------------------------------------------------------------
    // Phase 1: Check if this completes a pending chord
    // ------------------------------------------------------------------
    if (this.pendingChordKey !== null) {
      const firstKey = this.pendingChordKey
      this.clearChord()

      const secondKeyLower = event.key.toLowerCase()

      for (const shortcut of this.shortcuts.values()) {
        if (!this.isChord(shortcut.key)) continue
        if (shortcut.scope !== 'global' && shortcut.scope !== activeScope) continue

        const [chordFirst, chordSecond] = shortcut.key.split(' ')
        if (chordFirst.toLowerCase() !== firstKey) continue
        if (chordSecond.toLowerCase() !== secondKeyLower) continue

        // Chord shortcuts are always single-key, suppress in editable
        if (editable) return false

        if (shortcut.when && !shortcut.when()) continue

        event.preventDefault()
        shortcut.action()
        return true
      }

      // No chord matched — fall through to single-key matching
      // (the second key might be a standalone shortcut)
    }

    // ------------------------------------------------------------------
    // Phase 2: Check if this starts a chord
    // ------------------------------------------------------------------
    const keyLower = event.key.toLowerCase()

    for (const shortcut of this.shortcuts.values()) {
      if (!this.isChord(shortcut.key)) continue
      if (shortcut.scope !== 'global' && shortcut.scope !== activeScope) continue

      const [chordFirst] = shortcut.key.split(' ')
      if (chordFirst.toLowerCase() === keyLower) {
        // Suppress chord starters in editable elements
        if (editable) continue

        this.startChord(keyLower)
        return false // don't prevent default yet, wait for second key
      }
    }

    // ------------------------------------------------------------------
    // Phase 3: Single-key / modifier shortcuts
    // ------------------------------------------------------------------
    for (const shortcut of this.shortcuts.values()) {
      if (this.isChord(shortcut.key)) continue
      if (shortcut.scope !== 'global' && shortcut.scope !== activeScope) continue

      const parsed = parseKeyDescriptor(shortcut.key)

      // Suppress single-key shortcuts (no modifiers) in editable elements
      if (!hasModifiers(parsed) && editable) continue

      if (!eventMatchesParsedKey(event, parsed)) continue

      if (shortcut.when && !shortcut.when()) continue

      event.preventDefault()
      shortcut.action()
      return true
    }

    return false
  }

  // -------------------------------------------------------------------
  // Internal helpers
  // -------------------------------------------------------------------

  private isChord(key: string): boolean {
    return key.includes(' ')
  }

  private startChord(firstKey: string): void {
    this.pendingChordKey = firstKey
    this.chordTimer = setTimeout(() => {
      this.pendingChordKey = null
      this.chordTimer = null
    }, CHORD_TIMEOUT_MS)
  }

  private clearChord(): void {
    this.pendingChordKey = null
    if (this.chordTimer !== null) {
      clearTimeout(this.chordTimer)
      this.chordTimer = null
    }
  }

  /**
   * Reset internal state — useful for testing.
   * @internal
   */
  _reset(): void {
    this.shortcuts.clear()
    this.nextId = 0
    this.clearChord()
  }
}

export const shortcutRegistry = new ShortcutRegistry()

export type { ParsedKey }
// Re-export helpers for display in the help overlay
export { isMac, parseKeyDescriptor }
