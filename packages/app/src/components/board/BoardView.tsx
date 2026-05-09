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

import { DragDropContext, type DropResult } from '@hello-pangea/dnd'
import { useNavigate } from '@tanstack/react-router'
import { AlertTriangle, ArrowLeft, ChevronDown, LayoutDashboard, LayoutGrid, List, RefreshCw, Star } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { EmptyState } from '@/components/shared/EmptyState'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { authManager } from '@/lib/auth/manager'
import { getJiraClient } from '@/lib/jira/client'
import { useBoard, useBoards, useIssues, useTransitionMutation } from '@/lib/jira/queries'
import type { BoardColumn, JiraTransition } from '@/lib/jira/types'
import { recordBoardViewLoad } from '@/lib/telemetry/instruments/board'
import { useBoardStore } from '@/stores/board'
import { useBoardPrefsStore } from '@/stores/board-prefs'
import { toast } from '@/stores/toast'
import { BoardSkeleton } from './BoardSkeleton'
import { BoardTableView } from './BoardTableView'
import { CardDetail } from './CardDetail'
import { Column } from './Column'
import { FilterBar } from './FilterBar'
import { JiraSearch } from './JiraSearch'
import { StarredQuickAccess } from './StarredQuickAccess'
import { TransitionModal } from './TransitionModal'

function BoardSwitcher({ currentBoardId }: { currentBoardId: number }) {
  const navigate = useNavigate()
  const { data: boards } = useBoards()
  const { data: currentConfig } = useBoard(currentBoardId)
  const starredIds = useBoardPrefsStore((s) => s.starredBoardIds)
  const toggleStar = useBoardPrefsStore((s) => s.toggleStar)

  const currentName = currentConfig?.name ?? `Board ${currentBoardId}`

  const starredSet = useMemo(() => new Set(starredIds), [starredIds])
  const starred = useMemo(() => boards?.filter((b) => starredSet.has(b.id)) ?? [], [boards, starredSet])
  const unstarred = useMemo(() => boards?.filter((b) => !starredSet.has(b.id)) ?? [], [boards, starredSet])

  if (!boards || boards.length <= 1) {
    return <span className="text-sm font-medium text-foreground">{currentName}</span>
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 gap-1 text-sm font-medium">
          {currentName}
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-80 overflow-y-auto">
        {starred.length > 0 && (
          <>
            {starred.map((board) => (
              <BoardSwitcherItem
                key={board.id}
                board={board}
                isCurrent={board.id === currentBoardId}
                isStarred
                onNavigate={() => navigate({ to: '/board/$boardId', params: { boardId: String(board.id) } })}
                onToggleStar={() => toggleStar(board.id)}
              />
            ))}
            <DropdownMenuSeparator />
          </>
        )}
        {unstarred.map((board) => (
          <BoardSwitcherItem
            key={board.id}
            board={board}
            isCurrent={board.id === currentBoardId}
            isStarred={false}
            onNavigate={() => navigate({ to: '/board/$boardId', params: { boardId: String(board.id) } })}
            onToggleStar={() => toggleStar(board.id)}
          />
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            useBoardPrefsStore.getState().clearLastBoard()
            navigate({ to: '/board' })
          }}
        >
          All boards...
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function BoardSwitcherItem({
  board,
  isCurrent,
  isStarred,
  onNavigate,
  onToggleStar,
}: {
  board: { id: number; name: string; location?: { projectKey?: string } }
  isCurrent: boolean
  isStarred: boolean
  onNavigate: () => void
  onToggleStar: () => void
}) {
  return (
    <DropdownMenuItem className={`group gap-1.5 ${isCurrent ? 'bg-accent' : ''}`} onClick={onNavigate}>
      <button
        type="button"
        className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100 data-[starred=true]:opacity-100"
        data-starred={isStarred}
        onClick={(e) => {
          e.stopPropagation()
          onToggleStar()
        }}
      >
        <Star className={`h-3 w-3 ${isStarred ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`} />
      </button>
      <span className="flex-1 truncate">{board.name}</span>
      {board.location?.projectKey && (
        <span className="ml-2 text-[10px] text-muted-foreground">{board.location.projectKey}</span>
      )}
    </DropdownMenuItem>
  )
}

interface BoardViewProps {
  boardId: number
}

export function BoardView({ boardId }: BoardViewProps) {
  const navigate = useNavigate()
  const filters = useBoardStore((s) => s.filters)
  const optimisticUpdates = useBoardStore((s) => s.optimisticUpdates)
  const startDrag = useBoardStore((s) => s.startDrag)
  const endDrag = useBoardStore((s) => s.endDrag)
  const applyOptimisticUpdate = useBoardStore((s) => s.applyOptimisticUpdate)
  const rollbackOptimisticUpdate = useBoardStore((s) => s.rollbackOptimisticUpdate)

  const [selectedIssueKey, setSelectedIssueKey] = useState<string | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [viewMode, setViewMode] = useState<'kanban' | 'table'>('kanban')

  // TransitionModal state
  const [transitionModalOpen, setTransitionModalOpen] = useState(false)
  const [pendingTransition, setPendingTransition] = useState<{
    issueKey: string
    transition: JiraTransition
  } | null>(null)

  const { data: boardConfig, isLoading: boardLoading, error: boardError } = useBoard(boardId)

  const {
    data: issuesResponse,
    isLoading: issuesLoading,
    error: issuesError,
    dataUpdatedAt,
    refetch: refetchIssues,
    isFetching: issuesFetching,
  } = useIssues(boardId, filters)

  const transitionMutation = useTransitionMutation(boardId)

  const { data: allBoards } = useBoards()

  // Persist this board as the last-used board (with name + project key for the recent list)
  useEffect(() => {
    if (!boardConfig) return
    const board = allBoards?.find((b) => b.id === boardId)
    useBoardPrefsStore.getState().setLastBoard(boardId, boardConfig.name, board?.location?.projectKey)
    recordBoardViewLoad(boardId, board?.type ?? 'unknown')
  }, [boardId, boardConfig, allBoards])

  // Build columns from board config and issues
  const columns = useMemo<BoardColumn[]>(() => {
    if (!boardConfig || !issuesResponse) return []

    const issues = issuesResponse.issues

    return boardConfig.columnConfig.columns.map((col) => {
      const statusIds = new Set(col.statuses.map((s) => s.id))

      // Filter issues for this column, applying optimistic updates
      const columnIssues = issues.filter((issue) => {
        const optimistic = optimisticUpdates.get(issue.key)
        const effectiveStatusId = optimistic ? optimistic.targetStatusId : issue.fields.status.id
        return statusIds.has(effectiveStatusId)
      })

      // Apply client-side text filtering (other filters are handled via JQL)
      const filteredIssues = filters.text
        ? columnIssues.filter(
            (issue) =>
              issue.key.toLowerCase().includes(filters.text!.toLowerCase()) ||
              issue.fields.summary.toLowerCase().includes(filters.text!.toLowerCase()),
          )
        : columnIssues

      return {
        name: col.name,
        statusIds: Array.from(statusIds),
        issues: filteredIssues,
      }
    })
  }, [boardConfig, issuesResponse, optimisticUpdates, filters.text])

  const allIssues = issuesResponse?.issues ?? []

  // -----------------------------------------------------------------------
  // Drag and drop handler
  // -----------------------------------------------------------------------

  const handleDragStart = useCallback(
    (result: { draggableId: string; source: { droppableId: string } }) => {
      startDrag(result.draggableId, result.source.droppableId)
    },
    [startDrag],
  )

  const handleDragEnd = useCallback(
    async (result: DropResult) => {
      endDrag()

      const { draggableId: issueKey, source, destination } = result

      // Dropped outside a column or back in the same column
      if (!destination || source.droppableId === destination.droppableId) {
        return
      }

      const targetColumnName = destination.droppableId
      const targetColumn = columns.find((c) => c.name === targetColumnName)
      if (!targetColumn || targetColumn.statusIds.length === 0) return

      const issue = allIssues.find((i) => i.key === issueKey)
      if (!issue) return

      const targetStatusId = targetColumn.statusIds[0]

      // 1. Apply optimistic update
      applyOptimisticUpdate({
        issueKey,
        targetStatusId,
        originalStatusId: issue.fields.status.id,
        timestamp: Date.now(),
      })

      try {
        // 2. Fetch available transitions
        const client = getJiraClient()
        const transitions = await client.getTransitions(issueKey)

        // 3. Find a transition that targets the desired status
        const matchingTransition = transitions.find((t) => targetColumn.statusIds.includes(t.to.id))

        if (!matchingTransition) {
          // No valid transition — rollback
          rollbackOptimisticUpdate(issueKey)
          toast.error(
            'Transition unavailable',
            `No transition available from "${issue.fields.status.name}" to column "${targetColumnName}".`,
          )
          return
        }

        // 4. Check if transition requires fields
        if (matchingTransition.hasScreen) {
          // Show the transition modal so the user can fill in required fields.
          // The optimistic update stays in place until submit or cancel.
          setPendingTransition({ issueKey, transition: matchingTransition })
          setTransitionModalOpen(true)
          return
        }

        // 5. Execute the transition
        await transitionMutation.mutateAsync({
          issueKey,
          transitionId: matchingTransition.id,
        })

        // Success — remove optimistic update (real data will be fetched)
        rollbackOptimisticUpdate(issueKey)
        toast.success('Issue transitioned', `${issueKey} moved to "${matchingTransition.to.name}".`)
      } catch (error) {
        // Rollback on any failure
        rollbackOptimisticUpdate(issueKey)
        toast.error('Transition failed', error instanceof Error ? error.message : 'An unexpected error occurred.')
      }
    },
    [endDrag, columns, allIssues, applyOptimisticUpdate, rollbackOptimisticUpdate, transitionMutation],
  )

  // -----------------------------------------------------------------------
  // Transition modal handlers
  // -----------------------------------------------------------------------

  const handleTransitionSubmit = useCallback(
    async (fields: Record<string, unknown>) => {
      if (!pendingTransition) return

      const { issueKey, transition } = pendingTransition

      await transitionMutation.mutateAsync({
        issueKey,
        transitionId: transition.id,
        fields,
      })

      rollbackOptimisticUpdate(issueKey)
      setTransitionModalOpen(false)
      setPendingTransition(null)
      toast.success('Issue transitioned', `${issueKey} moved to "${transition.to.name}".`)
    },
    [pendingTransition, transitionMutation, rollbackOptimisticUpdate],
  )

  const handleTransitionCancel = useCallback(() => {
    if (pendingTransition) {
      rollbackOptimisticUpdate(pendingTransition.issueKey)
    }
    setTransitionModalOpen(false)
    setPendingTransition(null)
  }, [pendingTransition, rollbackOptimisticUpdate])

  // -----------------------------------------------------------------------
  // Card click handler — opens detail panel
  // -----------------------------------------------------------------------

  const handleCardClick = useCallback((issueKey: string) => {
    setSelectedIssueKey(issueKey)
    setDetailOpen(true)
  }, [])

  // -----------------------------------------------------------------------
  // Keyboard shortcut integration
  // -----------------------------------------------------------------------

  // Flatten all visible cards for keyboard navigation
  const flatIssueKeys = useMemo(() => columns.flatMap((col) => col.issues.map((i) => i.key)), [columns])

  // Keep totalCardCount in sync for bounds checking in the store
  const setTotalCardCount = useBoardStore((s) => s.setTotalCardCount)
  const focusedCardIndex = useBoardStore((s) => s.focusedCardIndex)

  useEffect(() => {
    setTotalCardCount(flatIssueKeys.length)
  }, [flatIssueKeys.length, setTotalCardCount])

  // Listen for custom events dispatched by board keyboard shortcuts
  useEffect(() => {
    function handleOpenFocused() {
      const idx = useBoardStore.getState().focusedCardIndex
      if (idx >= 0 && idx < flatIssueKeys.length) {
        handleCardClick(flatIssueKeys[idx])
      }
    }

    function handleCloseDetail() {
      setDetailOpen(false)
    }

    document.addEventListener('aegis:open-focused-card', handleOpenFocused)
    document.addEventListener('aegis:close-card-detail', handleCloseDetail)

    return () => {
      document.removeEventListener('aegis:open-focused-card', handleOpenFocused)
      document.removeEventListener('aegis:close-card-detail', handleCloseDetail)
    }
  }, [flatIssueKeys, handleCardClick])

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  if (boardLoading || issuesLoading) {
    return <BoardSkeleton />
  }

  if (boardError || issuesError) {
    const error = boardError ?? issuesError

    // If not authenticated with Atlassian, show auth-required empty state
    const jiraConfigured = !!localStorage.getItem('aegis_jira_config')
    if (!authManager.isConnected('atlassian') && !jiraConfigured) {
      return (
        <div className="flex h-full items-center justify-center p-8">
          <EmptyState
            variant="auth-required"
            icon={LayoutDashboard}
            title="Connect to Jira to see your boards"
            description="Go to Settings > Integrations and connect with a Jira API token."
            action={{
              label: 'Connect to Jira',
              onClick: () => {
                navigate({ to: '/settings' })
              },
            }}
          />
        </div>
      )
    }

    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8">
        <AlertTriangle className="h-10 w-10 text-destructive" />
        <p className="text-sm text-muted-foreground">
          Failed to load board: {error instanceof Error ? error.message : 'Unknown error'}
        </p>
      </div>
    )
  }

  // If board loaded but no issues match the current filters
  const hasNoIssues = issuesResponse && issuesResponse.issues.length === 0
  const hasActiveFilters =
    filters.text || filters.assignee || filters.component || filters.priority || filters.issueType

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
    )
  }

  // Format "last updated" timestamp
  const lastUpdated = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString() : null

  return (
    <div className="flex h-full flex-col">
      {/* Filter bar with refresh controls */}
      <FilterBar issues={allIssues} />

      {/* Board header with back button, board switcher, starred quick-access, refresh, and timestamp */}
      <div className="flex items-center gap-3 border-b border-border bg-card px-4 py-1.5">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          title="Back to boards"
          onClick={() => {
            useBoardPrefsStore.getState().clearLastBoard()
            navigate({ to: '/board' })
          }}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <BoardSwitcher currentBoardId={boardId} />
        <StarredQuickAccess currentBoardId={boardId} />
        <JiraSearch boardId={boardId} />
        <div className="flex-1" />
        {lastUpdated && <span className="text-xs text-muted-foreground">Last updated: {lastUpdated}</span>}
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
          <RefreshCw className={`h-3.5 w-3.5 ${issuesFetching ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Board content — kanban or table */}
      {viewMode === 'table' ? (
        <BoardTableView issues={allIssues} onCardClick={handleCardClick} />
      ) : (
        <DragDropContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="flex flex-1 flex-col gap-3 overflow-x-auto p-4 md:flex-row">
            {(() => {
              let runningIndex = 0
              return columns.map((column) => {
                const colStartIndex = runningIndex
                runningIndex += column.issues.length
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
                )
              })
            })()}
          </div>
        </DragDropContext>
      )}

      {/* Issue detail panel */}
      <CardDetail issueKey={selectedIssueKey} open={detailOpen} onOpenChange={setDetailOpen} />

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
  )
}
