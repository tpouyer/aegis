/**
 * Card — a single issue card on the kanban board.
 *
 * Draggable via @hello-pangea/dnd. Displays the issue key, summary,
 * priority indicator, story points, component badges, and assignee avatar.
 * Two action buttons at the bottom: [AI Chat] and [Open IDE].
 *
 * See design doc section 5.3 for the card layout specification.
 */

import { Draggable } from '@hello-pangea/dnd';
import { Link } from '@tanstack/react-router';
import { MessageSquare, Code2 } from 'lucide-react';
import {
  Card as CardContainer,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { JiraIssue } from '@/lib/jira/types';

interface IssueCardProps {
  issue: JiraIssue;
  index: number;
  onClick?: (issueKey: string) => void;
  isFocused?: boolean;
}

export function IssueCard({ issue, index, onClick, isFocused }: IssueCardProps) {
  const { key, fields } = issue;
  const storyPoints = getStoryPoints(fields);
  const priorityColor = getPriorityColor(fields.priority.name);

  return (
    <Draggable draggableId={key} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className="mb-2"
          aria-roledescription="draggable card"
          aria-label={`${key}: ${fields.summary}`}
        >
          <CardContainer
            className={`cursor-grab transition-shadow ${
              snapshot.isDragging
                ? 'shadow-lg ring-2 ring-primary/30'
                : isFocused
                  ? 'ring-2 ring-primary shadow-md'
                  : 'hover:shadow-md'
            }`}
            tabIndex={isFocused ? 0 : -1}
            aria-selected={isFocused}
            onClick={() => onClick?.(key)}
          >
            <CardContent className="p-3">
              {/* Header: issue key + priority indicator */}
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  {key}
                </span>
                <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <span
                    className={`inline-block h-2 w-2 rounded-full ${priorityColor}`}
                    aria-hidden="true"
                  />
                  {fields.priority.name}
                </span>
              </div>

              {/* Summary */}
              <p className="mb-2 text-sm font-medium leading-snug text-card-foreground line-clamp-2">
                {fields.summary}
              </p>

              {/* Metadata row: story points, components, assignee */}
              <div className="flex items-center gap-2">
                {/* Story points */}
                {storyPoints !== null && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    {storyPoints} SP
                  </Badge>
                )}

                {/* Components */}
                {fields.components.slice(0, 2).map((component) => (
                  <Badge
                    key={component.id}
                    variant="secondary"
                    className="text-[10px] px-1.5 py-0"
                  >
                    {component.name}
                  </Badge>
                ))}

                {/* Assignee avatar */}
                {fields.assignee && (
                  <div className="ml-auto flex-shrink-0" title={fields.assignee.displayName}>
                    <img
                      src={fields.assignee.avatarUrls['24x24']}
                      alt={fields.assignee.displayName}
                      className="h-5 w-5 rounded-full"
                    />
                  </div>
                )}
              </div>
            </CardContent>

            {/* Action buttons */}
            <CardFooter className="flex items-center justify-center gap-1 border-t border-border px-3 py-1.5">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                asChild
                onClick={(e) => e.stopPropagation()}
              >
                <Link to="/issue/$issueKey/chat" params={{ issueKey: key }} title="AI Chat">
                  <MessageSquare className="h-4 w-4" />
                </Link>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                asChild
                onClick={(e) => e.stopPropagation()}
              >
                <Link to="/issue/$issueKey/ide" params={{ issueKey: key }} title="Open IDE">
                  <Code2 className="h-4 w-4" />
                </Link>
              </Button>
            </CardFooter>
          </CardContainer>
        </div>
      )}
    </Draggable>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract story points from the issue fields (custom field varies by instance). */
function getStoryPoints(
  fields: JiraIssue['fields'],
): number | null {
  // Common custom field IDs for story points
  const candidates = [
    'customfield_10016', // Jira Cloud default
    'customfield_10028',
    'customfield_10004',
  ];

  for (const field of candidates) {
    const value = fields[field as keyof typeof fields];
    if (typeof value === 'number') return value;
  }

  return null;
}

/** Map priority name to a Tailwind background color class. */
function getPriorityColor(priorityName: string): string {
  const name = priorityName.toLowerCase();
  if (name.includes('highest') || name.includes('blocker'))
    return 'bg-red-500';
  if (name.includes('high') || name.includes('critical'))
    return 'bg-orange-500';
  if (name.includes('medium'))
    return 'bg-yellow-500';
  if (name.includes('low'))
    return 'bg-blue-400';
  if (name.includes('lowest'))
    return 'bg-slate-400';
  return 'bg-slate-400';
}
