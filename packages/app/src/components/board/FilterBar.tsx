/**
 * FilterBar — filter controls for the kanban board.
 *
 * Provides text search, assignee, component, priority, and issue type
 * dropdowns. Filter state is managed by the board Zustand store.
 */

import { X, Search, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useBoardStore } from '@/stores/board';
import type { JiraIssue } from '@/lib/jira/types';

interface FilterBarProps {
  issues: JiraIssue[];
}

export function FilterBar({ issues }: FilterBarProps) {
  const filters = useBoardStore((s) => s.filters);
  const setFilter = useBoardStore((s) => s.setFilter);
  const clearFilters = useBoardStore((s) => s.clearFilters);

  // Extract unique values from current issues for dropdown options
  const assignees = uniqueBy(
    issues
      .map((i) => i.fields.assignee)
      .filter((a): a is NonNullable<typeof a> => a !== null),
    (a) => a.accountId,
  );

  const components = uniqueBy(
    issues.flatMap((i) => i.fields.components),
    (c) => c.id,
  );

  const priorities = uniqueBy(
    issues.map((i) => i.fields.priority),
    (p) => p.id,
  );

  const issueTypes = uniqueBy(
    issues.map((i) => i.fields.issuetype),
    (t) => t.id,
  );

  const hasActiveFilters = Object.values(filters).some((v) => v !== null);

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border bg-card px-4 py-2">
      <Filter className="h-4 w-4 text-muted-foreground" />

      {/* Text search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search issues..."
          aria-label="Search issues"
          value={filters.text ?? ''}
          onChange={(e) =>
            setFilter('text', e.target.value || null)
          }
          className="h-8 w-full pl-8 pr-8 text-xs md:w-48"
          data-shortcut-target="filter-bar"
        />
        <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border border-border bg-muted px-1 py-0.5 font-mono text-[10px] text-muted-foreground">
          F
        </kbd>
      </div>

      {/* Assignee dropdown */}
      <FilterDropdown
        label="Assignee"
        value={filters.assignee}
        options={assignees.map((a) => ({
          id: a.accountId,
          label: a.displayName,
        }))}
        onSelect={(v) => setFilter('assignee', v)}
      />

      {/* Component dropdown */}
      <FilterDropdown
        label="Component"
        value={filters.component}
        options={components.map((c) => ({
          id: c.name,
          label: c.name,
        }))}
        onSelect={(v) => setFilter('component', v)}
      />

      {/* Priority dropdown */}
      <FilterDropdown
        label="Priority"
        value={filters.priority}
        options={priorities.map((p) => ({
          id: p.name,
          label: p.name,
        }))}
        onSelect={(v) => setFilter('priority', v)}
      />

      {/* Issue type dropdown */}
      <FilterDropdown
        label="Type"
        value={filters.issueType}
        options={issueTypes.map((t) => ({
          id: t.name,
          label: t.name,
        }))}
        onSelect={(v) => setFilter('issueType', v)}
      />

      {/* Clear filters */}
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearFilters}
          className="h-8 gap-1 text-xs text-muted-foreground"
        >
          <X className="h-3.5 w-3.5" />
          Clear Filters
        </Button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Internal components
// ---------------------------------------------------------------------------

interface FilterDropdownProps {
  label: string;
  value: string | null;
  options: Array<{ id: string; label: string }>;
  onSelect: (value: string | null) => void;
}

function FilterDropdown({
  label,
  value,
  options,
  onSelect,
}: FilterDropdownProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={value ? 'secondary' : 'outline'}
          size="sm"
          className="h-8 gap-1 text-xs"
        >
          {value ?? label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        <DropdownMenuLabel className="text-xs">{label}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {value && (
          <>
            <DropdownMenuItem
              onClick={() => onSelect(null)}
              className="text-xs text-muted-foreground"
            >
              Clear selection
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        {options.length === 0 && (
          <DropdownMenuItem disabled className="text-xs">
            No options available
          </DropdownMenuItem>
        )}
        {options.map((option) => (
          <DropdownMenuItem
            key={option.id}
            onClick={() => onSelect(option.id)}
            className="text-xs"
          >
            {option.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function uniqueBy<T>(items: T[], keyFn: (item: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = keyFn(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
