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
 *   4a. If transition requires fields, show TransitionModal
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { DragDropContext, type DropResult } from '@hello-pangea/dnd';
import { AlertTriangle, RefreshCw, LayoutDashboard, LayoutGrid, List } from 'lucide-react';
import { BoardSkeleton } from './BoardSkeleton';
import { BoardTableView } from './BoardTableView';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { useBoard, useIssues, useTransitionMutation } from '@/lib/jira/queries';
import { getJiraClient } from '@/lib/jira/client';
import { authManager } from '@/lib/auth/manager';
import { useBoardStore } from '@/stores/board';
import { toast } from '@/stores/toast';
import type { BoardColumn, JiraIssue, JiraTransition } from '@/lib/jira/types';
import { FilterBar } from './FilterBar';
import { Column } from './Column';
import { CardDetail } from './CardDetail';
import { TransitionModal } from './TransitionModal';

interface BoardViewProps {
  boardId: number;
}

export function BoardView({ boardId }: BoardViewProps) {
  const navigate = useNavigate();
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
  const [viewMode, setViewMode] = useState<'kanban' | 'table'>('kanban');

  // TransitionModal state
  const [transitionModalOpen, setTransitionModalOpen] = useState(false);
  const [pendingTransition, setPendingTransition] = useState<{
    issueKey: string;
    transition: JiraTransition;
  } | null>(null);

  const {
    data: boardConfig,
    isLoading: boardLoading,
    error: boardError,
  } = useBoard(boardId);

  const {
    data: issuesResponse,
    isLoading: issuesLoading,
    error: issuesError,
    dataUpdatedAt,
    refetch: refetchIssues,
    isFetching: issuesFetching,
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
          toast.error(
            'Transition unavailable',
            `No transition available from "${issue.fields.status.name}" to column "${targetColumnName}".`,
          );
          return;
        }

        // 4. Check if transition requires fields
        if (matchingTransition.hasScreen) {
          // Show the transition modal so the user can fill in required fields.
          // The optimistic update stays in place until submit or cancel.
          setPendingTransition({ issueKey, transition: matchingTransition });
          setTransitionModalOpen(true);
          return;
        }

        // 5. Execute the transition
        await transitionMutation.mutateAsync({
          issueKey,
          transitionId: matchingTransition.id,
        });

        // Success — remove optimistic update (real data will be fetched)
        rollbackOptimisticUpdate(issueKey);
        toast.success(
          'Issue transitioned',
          `${issueKey} moved to "${matchingTransition.to.name}".`,
        );
      } catch (error) {
        // Rollback on any failure
        rollbackOptimisticUpdate(issueKey);
        toast.error(
          'Transition failed',
          error instanceof Error ? error.message : 'An unexpected error occurred.',
        );
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
  // Transition modal handlers
  // -----------------------------------------------------------------------

  const handleTransitionSubmit = useCallback(
    async (fields: Record<string, unknown>) => {
      if (!pendingTransition) return;

      const { issueKey, transition } = pendingTransition;

      await transitionMutation.mutateAsync({
        issueKey,
        transitionId: transition.id,
        fields,
      });

      rollbackOptimisticUpdate(issueKey);
      setTransitionModalOpen(false);
      setPendingTransition(null);
      toast.success(
        'Issue transitioned',
        `${issueKey} moved to "${transition.to.name}".`,
      );
    },
    [pendingTransition, transitionMutation, rollbackOptimisticUpdate],
  );

  const handleTransitionCancel = useCallback(() => {
    if (pendingTransition) {
      rollbackOptimisticUpdate(pendingTransition.issueKey);
    }
    setTransitionModalOpen(false);
    setPendingTransition(null);
  }, [pendingTransition, rollbackOptimisticUpdate]);

  // -----------------------------------------------------------------------
  // Card click handler — opens detail panel
  // -----------------------------------------------------------------------

  const handleCardClick = useCallback((issueKey: string) => {
    setSelectedIssueKey(issueKey);
    setDetailOpen(true);
  }, []);

  // -----------------------------------------------------------------------
  // Keyboard shortcut integration
  // -----------------------------------------------------------------------

  // Flatten all visible cards for keyboard navigation
  const flatIssueKeys = useMemo(
    () => columns.flatMap((col) => col.issues.map((i) => i.key)),
    [columns],
  );

  // Keep totalCardCount in sync for bounds checking in the store
  const setTotalCardCount = useBoardStore((s) => s.setTotalCardCount);
  const focusedCardIndex = useBoardStore((s) => s.focusedCardIndex);

  useEffect(() => {
    setTotalCardCount(flatIssueKeys.length);
  }, [flatIssueKeys.length, setTotalCardCount]);

  // Listen for custom events dispatched by board keyboard shortcuts
  useEffect(() => {
    function handleOpenFocused() {
      const idx = useBoardStore.getState().focusedCardIndex;
      if (idx >= 0 && idx < flatIssueKeys.length) {
        handleCardClick(flatIssueKeys[idx]);
      }
    }

    function handleCloseDetail() {
      setDetailOpen(false);
    }

    document.addEventListener('aegis:open-focused-card', handleOpenFocused);
    document.addEventListener('aegis:close-card-detail', handleCloseDetail);

    return () => {
      document.removeEventListener('aegis:open-focused-card', handleOpenFocused);
      document.removeEventListener('aegis:close-card-detail', handleCloseDetail);
    };
  }, [flatIssueKeys, handleCardClick]);

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  if (boardLoading || issuesLoading) {
    return <BoardSkeleton />;
  }

  if (boardError || issuesError) {
    const error = boardError ?? issuesError;

    // If not authenticated with Atlassian, show auth-required empty state
    if (!authManager.isConnected('atlassian')) {
      return (
        <div className="flex h-full items-center justify-center p-8">
          <EmptyState
            variant="auth-required"
            icon={LayoutDashboard}
            title="Connect to Jira to see your boards"
            description="Link your Atlassian account to load boards, view issues, and transition cards with drag-and-drop."
            action={{
              label: 'Connect to Jira',
              onClick: () => {
                navigate({ to: '/settings' });
              },
            }}
          />
        </div>
      );
    }

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

  // If board loaded but no issues match the current filters
  const hasNoIssues = issuesResponse && issuesResponse.issues.length === 0;
  const hasActiveFilters =
    filters.text || filters.assignee || filters.component || filters.priority || filters.issueType;

  if (hasNoIssues && hasActiveFilters) {
    return (
      <div className="flex h-full flex-col">
        <FilterBar issues={allIssues} />
        <div className="flex flex-1 items-center justify-center p-8">
          <EmptyState
            variant="no-data"
            title="No issues match your filters"
            description="Try adjusting or clearing your filters to see more issues on this board."
            action={{
              label: 'Clear Filters',
              onClick: () => useBoardStore.getState().clearFilters(),
              variant: 'outline',
            }}
          />
        </div>
      </div>
    );
  }

  // Format "last updated" timestamp
  const lastUpdated = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString()
    : null;

  return (
    <div className="flex h-full flex-col">
      {/* Filter bar with refresh controls */}
      <FilterBar issues={allIssues} />

      {/* Board header with refresh button and timestamp */}
      <div className="flex items-center justify-end gap-3 border-b border-border bg-card px-4 py-1.5">
        {lastUpdated && (
          <span className="text-xs text-muted-foreground">
            Last updated: {lastUpdated}
          </span>
        )}
        <div className="flex items-center gap-0.5 rounded-md border border-border p-0.5">
          <Button
            variant={viewMode === 'kanban' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => setViewMode('kanban')}
            title="Kanban view"
          >
            <LayoutGrid className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant={viewMode === 'table' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => setViewMode('table')}
            title="Table view"
          >
            <List className="h-3.5 w-3.5" />
          </Button>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 text-xs"
          onClick={() => refetchIssues()}
          disabled={issuesFetching}
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${issuesFetching ? 'animate-spin' : ''}`}
          />
          Refresh
        </Button>
      </div>

      {/* Board content — kanban or table */}
      {viewMode === 'table' ? (
        <BoardTableView issues={allIssues} onCardClick={handleCardClick} />
      ) : (
      <DragDropContext
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex flex-1 flex-col gap-3 overflow-x-auto p-4 md:flex-row">
          {(() => {
            let runningIndex = 0;
            return columns.map((column) => {
              const colStartIndex = runningIndex;
              runningIndex += column.issues.length;
              return (
                <Column
                  key={column.name}
                  columnId={column.name}
                  name={column.name}
                  issues={column.issues}
                  onCardClick={handleCardClick}
                  focusedGlobalIndex={focusedCardIndex}
                  startIndex={colStartIndex}
                />
              );
            });
          })()}
        </div>
      </DragDropContext>
      )}

      {/* Issue detail panel */}
      <CardDetail
        issueKey={selectedIssueKey}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />

      {/* Transition modal for fields-required transitions */}
      {pendingTransition && (
        <TransitionModal
          open={transitionModalOpen}
          issueKey={pendingTransition.issueKey}
          transition={pendingTransition.transition}
          onSubmit={handleTransitionSubmit}
          onCancel={handleTransitionCancel}
        />
      )}
    </div>
  );
}
