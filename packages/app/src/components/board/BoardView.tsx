/**
 * BoardView — main kanban board layout.
 *
 * Fetches board configuration and issues via TanStack Query hooks,
 * then renders the FilterBar, horizontal scrolling columns, and
 * the CardDetail slide-over panel.
 *
 * Drag-and-drop transitions follow the pattern in design doc section 5.4:
 *   1. Optimistic UI update via Zustand
 *   2. Fetch available transitions
 *   3. Find transition matching target status
 *   4. Execute transition (or rollback on failure)
 */

import { useState, useCallback, useMemo } from 'react';
import { DragDropContext, type DropResult } from '@hello-pangea/dnd';
import { AlertTriangle } from 'lucide-react';
import { Loading } from '@/components/shared/Loading';
import { useBoard, useIssues, useTransitionMutation } from '@/lib/jira/queries';
import { getJiraClient } from '@/lib/jira/client';
import { useBoardStore } from '@/stores/board';
import type { BoardColumn, JiraIssue } from '@/lib/jira/types';
import { FilterBar } from './FilterBar';
import { Column } from './Column';
import { CardDetail } from './CardDetail';

interface BoardViewProps {
  boardId: number;
}

export function BoardView({ boardId }: BoardViewProps) {
  const filters = useBoardStore((s) => s.filters);
  const optimisticUpdates = useBoardStore((s) => s.optimisticUpdates);
  const startDrag = useBoardStore((s) => s.startDrag);
  const endDrag = useBoardStore((s) => s.endDrag);
  const applyOptimisticUpdate = useBoardStore((s) => s.applyOptimisticUpdate);
  const rollbackOptimisticUpdate = useBoardStore(
    (s) => s.rollbackOptimisticUpdate,
  );

  const [selectedIssueKey, setSelectedIssueKey] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const {
    data: boardConfig,
    isLoading: boardLoading,
    error: boardError,
  } = useBoard(boardId);

  const {
    data: issuesResponse,
    isLoading: issuesLoading,
    error: issuesError,
  } = useIssues(boardId, filters);

  const transitionMutation = useTransitionMutation(boardId);

  // Build columns from board config and issues
  const columns = useMemo<BoardColumn[]>(() => {
    if (!boardConfig || !issuesResponse) return [];

    const issues = issuesResponse.issues;

    return boardConfig.columnConfig.columns.map((col) => {
      const statusIds = new Set(col.statuses.map((s) => s.id));

      // Filter issues for this column, applying optimistic updates
      const columnIssues = issues.filter((issue) => {
        const optimistic = optimisticUpdates.get(issue.key);
        const effectiveStatusId = optimistic
          ? optimistic.targetStatusId
          : issue.fields.status.id;
        return statusIds.has(effectiveStatusId);
      });

      // Apply client-side text filtering (other filters are handled via JQL)
      const filteredIssues = filters.text
        ? columnIssues.filter(
            (issue) =>
              issue.key
                .toLowerCase()
                .includes(filters.text!.toLowerCase()) ||
              issue.fields.summary
                .toLowerCase()
                .includes(filters.text!.toLowerCase()),
          )
        : columnIssues;

      return {
        name: col.name,
        statusIds: Array.from(statusIds),
        issues: filteredIssues,
      };
    });
  }, [boardConfig, issuesResponse, optimisticUpdates, filters.text]);

  const allIssues = issuesResponse?.issues ?? [];

  // -----------------------------------------------------------------------
  // Drag and drop handler
  // -----------------------------------------------------------------------

  const handleDragStart = useCallback(
    (result: { draggableId: string; source: { droppableId: string } }) => {
      startDrag(result.draggableId, result.source.droppableId);
    },
    [startDrag],
  );

  const handleDragEnd = useCallback(
    async (result: DropResult) => {
      endDrag();

      const { draggableId: issueKey, source, destination } = result;

      // Dropped outside a column or back in the same column
      if (!destination || source.droppableId === destination.droppableId) {
        return;
      }

      const targetColumnName = destination.droppableId;
      const targetColumn = columns.find((c) => c.name === targetColumnName);
      if (!targetColumn || targetColumn.statusIds.length === 0) return;

      const issue = allIssues.find((i) => i.key === issueKey);
      if (!issue) return;

      const targetStatusId = targetColumn.statusIds[0];

      // 1. Apply optimistic update
      applyOptimisticUpdate({
        issueKey,
        targetStatusId,
        originalStatusId: issue.fields.status.id,
        timestamp: Date.now(),
      });

      try {
        // 2. Fetch available transitions
        const client = getJiraClient();
        const transitions = await client.getTransitions(issueKey);

        // 3. Find a transition that targets the desired status
        const matchingTransition = transitions.find((t) =>
          targetColumn.statusIds.includes(t.to.id),
        );

        if (!matchingTransition) {
          // No valid transition — rollback
          rollbackOptimisticUpdate(issueKey);
          console.warn(
            `No transition available from ${issue.fields.status.name} to column "${targetColumnName}"`,
          );
          return;
        }

        // 4. Check if transition requires fields
        if (matchingTransition.hasScreen) {
          // For now, rollback transitions that require a screen.
          // A modal for field entry would be added here in the future.
          rollbackOptimisticUpdate(issueKey);
          console.warn(
            `Transition "${matchingTransition.name}" requires additional fields.`,
          );
          return;
        }

        // 5. Execute the transition
        await transitionMutation.mutateAsync({
          issueKey,
          transitionId: matchingTransition.id,
        });

        // Success — remove optimistic update (real data will be fetched)
        rollbackOptimisticUpdate(issueKey);
      } catch (error) {
        // Rollback on any failure
        rollbackOptimisticUpdate(issueKey);
        console.error('Transition failed:', error);
      }
    },
    [
      endDrag,
      columns,
      allIssues,
      applyOptimisticUpdate,
      rollbackOptimisticUpdate,
      transitionMutation,
    ],
  );

  // -----------------------------------------------------------------------
  // Card click handler — opens detail panel
  // -----------------------------------------------------------------------

  const handleCardClick = useCallback((issueKey: string) => {
    setSelectedIssueKey(issueKey);
    setDetailOpen(true);
  }, []);

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  if (boardLoading || issuesLoading) {
    return <Loading className="h-full" message="Loading board..." />;
  }

  if (boardError || issuesError) {
    const error = boardError ?? issuesError;
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8">
        <AlertTriangle className="h-10 w-10 text-destructive" />
        <p className="text-sm text-muted-foreground">
          Failed to load board:{' '}
          {error instanceof Error ? error.message : 'Unknown error'}
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Filter bar */}
      <FilterBar issues={allIssues} />

      {/* Board columns */}
      <DragDropContext
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex flex-1 gap-3 overflow-x-auto p-4">
          {columns.map((column) => (
            <Column
              key={column.name}
              columnId={column.name}
              name={column.name}
              issues={column.issues}
              onCardClick={handleCardClick}
            />
          ))}
        </div>
      </DragDropContext>

      {/* Issue detail panel */}
      <CardDetail
        issueKey={selectedIssueKey}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </div>
  );
}
