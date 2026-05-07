/**
 * Column — a single status column on the kanban board.
 *
 * Acts as a Droppable zone for @hello-pangea/dnd. Renders a header
 * with the status name and issue count, followed by the list of
 * IssueCard components.
 */

import { Droppable } from '@hello-pangea/dnd'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { JiraIssue } from '@/lib/jira/types'
import { IssueCard } from './Card'

interface ColumnProps {
  columnId: string
  name: string
  issues: JiraIssue[]
  onCardClick?: (issueKey: string) => void
  focusedGlobalIndex?: number
  startIndex?: number
}

export function Column({ columnId, name, issues, onCardClick, focusedGlobalIndex = -1, startIndex = 0 }: ColumnProps) {
  return (
    <div className="flex h-full w-full flex-shrink-0 flex-col rounded-lg border border-border bg-muted/30 md:w-72">
      {/* Column header */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <h2 className="text-sm font-semibold text-foreground">{name}</h2>
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
          {issues.length}
        </Badge>
      </div>

      {/* Droppable area */}
      <Droppable droppableId={columnId}>
        {(provided, snapshot) => (
          <ScrollArea className="flex-1">
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              aria-label={`${name} column, ${issues.length} issues`}
              className={`min-h-[120px] p-2 transition-colors ${
                snapshot.isDraggingOver ? 'bg-primary/5 ring-1 ring-inset ring-primary/20' : ''
              }`}
            >
              {issues.map((issue, index) => (
                <IssueCard
                  key={issue.key}
                  issue={issue}
                  index={index}
                  onClick={onCardClick}
                  isFocused={focusedGlobalIndex === startIndex + index}
                />
              ))}
              {provided.placeholder}

              {/* Empty state */}
              {issues.length === 0 && !snapshot.isDraggingOver && (
                <p className="py-8 text-center text-xs text-muted-foreground">No issues</p>
              )}
            </div>
          </ScrollArea>
        )}
      </Droppable>
    </div>
  )
}
