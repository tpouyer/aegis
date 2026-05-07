/**
 * BoardTableView — sortable table view for board issues.
 *
 * Renders all issues in a full-detail table with sortable column
 * headers. Columns: Key, Summary, Status, Priority, Assignee, Type,
 * Story Points, Components.
 */

import { useState, useMemo } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { JiraIssue } from '@/lib/jira/types';

interface BoardTableViewProps {
  issues: JiraIssue[];
  onCardClick?: (issueKey: string) => void;
}

type SortField = 'key' | 'summary' | 'status' | 'priority' | 'assignee' | 'type';
type SortDir = 'asc' | 'desc';

/** Extract story points from whichever custom field holds them. */
function getStoryPoints(issue: JiraIssue): number | null {
  for (const [key, value] of Object.entries(issue.fields)) {
    if (key.startsWith('customfield_') && typeof value === 'number') {
      return value;
    }
  }
  return null;
}

/** Map status category keys to badge variants for visual distinction. */
function statusVariant(
  categoryKey: string,
): 'default' | 'secondary' | 'outline' {
  switch (categoryKey) {
    case 'done':
      return 'default';
    case 'indeterminate':
      return 'secondary';
    default:
      return 'outline';
  }
}

export function BoardTableView({ issues, onCardClick }: BoardTableViewProps) {
  const [sortField, setSortField] = useState<SortField>('key');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const sorted = useMemo(() => {
    return [...issues].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'key': cmp = a.key.localeCompare(b.key); break;
        case 'summary': cmp = a.fields.summary.localeCompare(b.fields.summary); break;
        case 'status': cmp = a.fields.status.name.localeCompare(b.fields.status.name); break;
        case 'priority': cmp = a.fields.priority.name.localeCompare(b.fields.priority.name); break;
        case 'assignee': cmp = (a.fields.assignee?.displayName ?? '').localeCompare(b.fields.assignee?.displayName ?? ''); break;
        case 'type': cmp = a.fields.issuetype.name.localeCompare(b.fields.issuetype.name); break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [issues, sortField, sortDir]);

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  }

  function SortHeader({ field, label }: { field: SortField; label: string }) {
    return (
      <th
        className="whitespace-nowrap border-b border-border px-4 py-2 text-left text-xs font-medium uppercase text-muted-foreground hover:text-foreground"
        onClick={() => handleSort(field)}
      >
        <span className="flex cursor-pointer select-none items-center gap-1">
          {label}
          {sortField === field &&
            (sortDir === 'asc' ? (
              <ChevronUp className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            ))}
        </span>
      </th>
    );
  }

  return (
    <ScrollArea className="flex-1">
      <div className="min-w-[900px]">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-card">
            <tr>
              <SortHeader field="key" label="Key" />
              <SortHeader field="summary" label="Summary" />
              <SortHeader field="status" label="Status" />
              <SortHeader field="priority" label="Priority" />
              <SortHeader field="assignee" label="Assignee" />
              <SortHeader field="type" label="Type" />
              <th className="whitespace-nowrap border-b border-border px-4 py-2 text-left text-xs font-medium uppercase text-muted-foreground">
                Points
              </th>
              <th className="whitespace-nowrap border-b border-border px-4 py-2 text-left text-xs font-medium uppercase text-muted-foreground">
                Components
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((issue, idx) => {
              const points = getStoryPoints(issue);
              return (
                <tr
                  key={issue.key}
                  className={`cursor-pointer border-b border-border transition-colors hover:bg-accent ${
                    idx % 2 === 1 ? 'bg-muted/30' : ''
                  }`}
                  onClick={() => onCardClick?.(issue.key)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onCardClick?.(issue.key);
                    }
                  }}
                >
                  <td className="whitespace-nowrap px-4 py-2 font-medium text-primary">
                    {issue.key}
                  </td>
                  <td className="max-w-xs truncate px-4 py-2 text-foreground">
                    {issue.fields.summary}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2">
                    <Badge
                      variant={statusVariant(issue.fields.status.statusCategory.key)}
                      className="text-xs"
                    >
                      {issue.fields.status.name}
                    </Badge>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2">
                    <Badge variant="outline" className="text-xs">
                      {issue.fields.priority.name}
                    </Badge>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 text-muted-foreground">
                    {issue.fields.assignee?.displayName ?? (
                      <span className="italic">Unassigned</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2">
                    <Badge variant="outline" className="text-xs">
                      {issue.fields.issuetype.name}
                    </Badge>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 text-muted-foreground">
                    {points ?? '—'}
                  </td>
                  <td className="px-4 py-2">
                    {issue.fields.components.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {issue.fields.components.map((comp) => (
                          <Badge
                            key={comp.id}
                            variant="outline"
                            className="text-xs"
                          >
                            {comp.name}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {sorted.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  No issues to display
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </ScrollArea>
  );
}
