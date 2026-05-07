/**
 * Command registry — manages registered commands and provides fuzzy
 * search over labels, descriptions, and keywords.
 *
 * Usage:
 *   commandRegistry.register({ id: 'nav.home', label: 'Go to Home', ... });
 *   const results = commandRegistry.search('home');
 */

import type { Command, CommandCategory } from './types'

// ---------------------------------------------------------------------------
// Scoring helpers
// ---------------------------------------------------------------------------

/**
 * Score a single haystack string against a query word.
 * Returns 0 (no match), 1 (keyword/substring), 2 (prefix match).
 */
function scoreWord(haystack: string, queryWord: string): number {
  if (haystack.startsWith(queryWord)) return 2
  if (haystack.includes(queryWord)) return 1
  return 0
}

/**
 * Score a command against a full query string.
 * Returns 0 if any query word fails to match; otherwise a positive relevance score.
 * Higher = more relevant.
 */
function scoreCommand(command: Command, query: string): number {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) return 1 // empty query matches everything

  const label = command.label.toLowerCase()
  const description = (command.description ?? '').toLowerCase()
  const keywords = (command.keywords ?? []).map((k) => k.toLowerCase())

  let total = 0

  for (const word of words) {
    const labelScore = scoreWord(label, word)
    const descScore = scoreWord(description, word)
    const kwScore = Math.max(0, ...keywords.map((kw) => scoreWord(kw, word)))

    // Take the best match across fields, but prioritise label > description > keywords
    const best = Math.max(labelScore * 3, descScore * 2, kwScore)
    if (best === 0) return 0 // this word didn't match anything
    total += best
  }

  return total
}

// ---------------------------------------------------------------------------
// CommandRegistry
// ---------------------------------------------------------------------------

export class CommandRegistry {
  private commands = new Map<string, Command>()

  /**
   * Register a command. Returns a dispose function that unregisters it.
   */
  register(command: Command): () => void {
    this.commands.set(command.id, command)
    return () => {
      this.commands.delete(command.id)
    }
  }

  /**
   * Search for commands matching `query`.
   *
   * Each whitespace-separated word must match the label, description,
   * or keywords (case-insensitive). Results are sorted by relevance:
   * prefix matches rank higher than substring matches, and label
   * matches rank higher than keyword matches.
   *
   * Commands whose `when` predicate returns false are excluded.
   */
  search(query: string): Command[] {
    const visible = this.getVisible()
    const scored: Array<{ command: Command; score: number }> = []

    for (const command of visible) {
      const score = scoreCommand(command, query)
      if (score > 0) {
        scored.push({ command, score })
      }
    }

    scored.sort((a, b) => b.score - a.score)
    return scored.map((s) => s.command)
  }

  /**
   * Get all registered commands, optionally filtered by category.
   * Commands whose `when` predicate returns false are excluded.
   */
  getAll(category?: CommandCategory): Command[] {
    const visible = this.getVisible()
    if (category) {
      return visible.filter((c) => c.category === category)
    }
    return visible
  }

  /**
   * Execute a command by id. No-op if the command is not found.
   */
  execute(id: string): void {
    const command = this.commands.get(id)
    if (command) {
      command.action()
    }
  }

  // -----------------------------------------------------------------------
  // Internal
  // -----------------------------------------------------------------------

  private getVisible(): Command[] {
    return Array.from(this.commands.values()).filter((c) => !c.when || c.when())
  }
}

/** Singleton command registry for the application. */
export const commandRegistry = new CommandRegistry()
