/**
 * Command palette types.
 *
 * Defines the shape of a command that can be registered with the
 * global command palette and discovered via fuzzy search.
 */

import type React from 'react';

export type CommandCategory = 'navigation' | 'issue' | 'file' | 'action';

export interface Command {
  /** Unique identifier for the command (e.g. "nav.go-to-board"). */
  id: string;
  /** Human-readable label shown in the palette list. */
  label: string;
  /** Optional description shown as secondary text. */
  description?: string;
  /** Optional icon component rendered next to the label. */
  icon?: React.ComponentType;
  /** Category used for grouping and mode-based filtering. */
  category: CommandCategory;
  /** Extra words that improve search recall but aren't in the label. */
  keywords?: string[];
  /** The function to run when the command is selected. */
  action: () => void;
  /** Display hint for keyboard shortcut (e.g. "⌘K"). */
  shortcut?: string;
  /** Conditional visibility — if provided and returns false, hide the command. */
  when?: () => boolean;
}
