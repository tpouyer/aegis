/**
 * Global command palette — triggered by Cmd+K / Ctrl+K.
 *
 * Provides fuzzy search over all registered commands with keyboard
 * navigation (arrow keys, Enter to execute, Escape to close) and
 * mode-based filtering via prefix characters:
 *   - Default: show all commands
 *   - `>` prefix: filter to "file" category
 *   - `/` prefix: filter to "action" category
 */

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { commandRegistry } from '@/lib/commands/registry';
import type { Command, CommandCategory } from '@/lib/commands/types';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Category labels for group headers
// ---------------------------------------------------------------------------

const CATEGORY_LABELS: Record<CommandCategory, string> = {
  navigation: 'Navigation',
  issue: 'Issues',
  file: 'Files',
  action: 'Actions',
};

const CATEGORY_ORDER: CommandCategory[] = ['navigation', 'issue', 'file', 'action'];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const [query, setQuery] = React.useState('');
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);

  // Reset state when dialog opens
  React.useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      // Focus the input after the dialog renders
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  }, [open]);

  // -----------------------------------------------------------------------
  // Derive filtered and grouped commands
  // -----------------------------------------------------------------------

  const { flatCommands, groups } = React.useMemo(() => {
    let searchQuery = query;
    let categoryFilter: CommandCategory | undefined;

    // Detect mode prefix
    if (searchQuery.startsWith('>')) {
      categoryFilter = 'file';
      searchQuery = searchQuery.slice(1).trim();
    } else if (searchQuery.startsWith('/')) {
      categoryFilter = 'action';
      searchQuery = searchQuery.slice(1).trim();
    }

    let results: Command[];

    if (searchQuery) {
      results = commandRegistry.search(searchQuery);
    } else {
      results = commandRegistry.getAll();
    }

    if (categoryFilter) {
      results = results.filter((c) => c.category === categoryFilter);
    }

    // Group by category in a stable order
    const grouped = new Map<CommandCategory, Command[]>();
    for (const cmd of results) {
      const list = grouped.get(cmd.category) ?? [];
      list.push(cmd);
      grouped.set(cmd.category, list);
    }

    const orderedGroups: Array<{ category: CommandCategory; commands: Command[] }> = [];
    for (const cat of CATEGORY_ORDER) {
      const cmds = grouped.get(cat);
      if (cmds && cmds.length > 0) {
        orderedGroups.push({ category: cat, commands: cmds });
      }
    }

    const flat = orderedGroups.flatMap((g) => g.commands);

    return { flatCommands: flat, groups: orderedGroups };
  }, [query]);

  // Clamp selected index when results change
  React.useEffect(() => {
    setSelectedIndex((prev) =>
      flatCommands.length === 0 ? 0 : Math.min(prev, flatCommands.length - 1),
    );
  }, [flatCommands]);

  // -----------------------------------------------------------------------
  // Keyboard handling
  // -----------------------------------------------------------------------

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev < flatCommands.length - 1 ? prev + 1 : 0,
          );
          break;

        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev > 0 ? prev - 1 : flatCommands.length - 1,
          );
          break;

        case 'Enter':
          e.preventDefault();
          if (flatCommands[selectedIndex]) {
            flatCommands[selectedIndex].action();
            onOpenChange(false);
          }
          break;

        case 'Escape':
          e.preventDefault();
          onOpenChange(false);
          break;
      }
    },
    [flatCommands, selectedIndex, onOpenChange],
  );

  // Scroll selected item into view
  React.useEffect(() => {
    const selectedEl = listRef.current?.querySelector(
      `[data-command-index="${selectedIndex}"]`,
    );
    if (selectedEl && typeof selectedEl.scrollIntoView === 'function') {
      selectedEl.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  // Build a flat index counter across groups
  let runningIndex = 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-xl gap-0 overflow-hidden p-0"
        onKeyDown={handleKeyDown}
        aria-label="Command palette"
        aria-describedby={undefined}
      >
        {/* Accessible title (visually hidden) */}
        <DialogTitle className="sr-only">Command Palette</DialogTitle>

        {/* Search input */}
        <div className="border-b px-3 py-2">
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Type a command..."
            className="border-0 shadow-none focus-visible:ring-0"
            aria-label="Command search"
          />
        </div>

        {/* Command list */}
        <ScrollArea className="max-h-72">
          <div ref={listRef} role="listbox" aria-label="Commands">
            {groups.length === 0 && (
              <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                No commands found.
              </div>
            )}

            {groups.map((group) => {
              const startIndex = runningIndex;
              const items = group.commands.map((cmd, i) => {
                const globalIdx = startIndex + i;
                const isSelected = globalIdx === selectedIndex;

                return (
                  <button
                    key={cmd.id}
                    data-command-index={globalIdx}
                    role="option"
                    aria-selected={isSelected}
                    className={cn(
                      'flex w-full items-center justify-between px-4 py-2 text-left text-sm transition-colors',
                      isSelected
                        ? 'bg-accent text-accent-foreground'
                        : 'hover:bg-accent/50',
                    )}
                    onClick={() => {
                      cmd.action();
                      onOpenChange(false);
                    }}
                    onMouseEnter={() => setSelectedIndex(globalIdx)}
                  >
                    <div className="flex items-center gap-2">
                      {cmd.icon && <cmd.icon />}
                      <span>{cmd.label}</span>
                      {cmd.description && (
                        <span className="text-muted-foreground">
                          {cmd.description}
                        </span>
                      )}
                    </div>
                    {cmd.shortcut && (
                      <kbd className="ml-auto rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                        {cmd.shortcut}
                      </kbd>
                    )}
                  </button>
                );
              });

              runningIndex += group.commands.length;

              return (
                <div key={group.category}>
                  <div className="px-4 py-1.5 text-xs font-semibold text-muted-foreground">
                    {CATEGORY_LABELS[group.category]}
                  </div>
                  {items}
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
