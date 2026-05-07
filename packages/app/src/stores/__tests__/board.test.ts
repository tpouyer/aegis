import { afterEach, describe, expect, it } from 'vitest'
import type { OptimisticUpdate } from '../board'
import { useBoardStore } from '../board'

// Reset the store between tests to avoid state leaking
afterEach(() => {
  useBoardStore.setState({
    dragState: {
      isDragging: false,
      sourceColumn: null,
      targetColumn: null,
      draggedIssueKey: null,
    },
    filters: {
      assignee: null,
      component: null,
      priority: null,
      text: null,
      issueType: null,
    },
    optimisticUpdates: new Map(),
  })
})

describe('useBoardStore', () => {
  // -----------------------------------------------------------------------
  // Initial state
  // -----------------------------------------------------------------------

  it('has empty filters in initial state', () => {
    const { filters } = useBoardStore.getState()

    expect(filters.assignee).toBeNull()
    expect(filters.component).toBeNull()
    expect(filters.priority).toBeNull()
    expect(filters.text).toBeNull()
    expect(filters.issueType).toBeNull()
  })

  it('has no active drag in initial state', () => {
    const { dragState } = useBoardStore.getState()

    expect(dragState.isDragging).toBe(false)
    expect(dragState.draggedIssueKey).toBeNull()
    expect(dragState.sourceColumn).toBeNull()
    expect(dragState.targetColumn).toBeNull()
  })

  // -----------------------------------------------------------------------
  // setFilter
  // -----------------------------------------------------------------------

  it('setFilter updates a specific filter without affecting others', () => {
    const { setFilter } = useBoardStore.getState()

    setFilter('assignee', 'user-123')
    setFilter('priority', 'High')

    const { filters } = useBoardStore.getState()
    expect(filters.assignee).toBe('user-123')
    expect(filters.priority).toBe('High')
    expect(filters.component).toBeNull()
    expect(filters.text).toBeNull()
    expect(filters.issueType).toBeNull()
  })

  // -----------------------------------------------------------------------
  // clearFilters
  // -----------------------------------------------------------------------

  it('clearFilters resets all filters to null', () => {
    const { setFilter, clearFilters } = useBoardStore.getState()

    setFilter('assignee', 'user-123')
    setFilter('component', 'api')
    setFilter('priority', 'High')
    setFilter('text', 'search term')
    setFilter('issueType', 'Bug')

    clearFilters()

    const { filters } = useBoardStore.getState()
    expect(filters.assignee).toBeNull()
    expect(filters.component).toBeNull()
    expect(filters.priority).toBeNull()
    expect(filters.text).toBeNull()
    expect(filters.issueType).toBeNull()
  })

  // -----------------------------------------------------------------------
  // Optimistic updates
  // -----------------------------------------------------------------------

  it('applyOptimisticUpdate adds entry and rollbackOptimisticUpdate removes it', () => {
    const { applyOptimisticUpdate, rollbackOptimisticUpdate } = useBoardStore.getState()

    const update: OptimisticUpdate = {
      issueKey: 'AAP-100',
      targetStatusId: 'status-2',
      originalStatusId: 'status-1',
      timestamp: Date.now(),
    }

    applyOptimisticUpdate(update)

    let { optimisticUpdates } = useBoardStore.getState()
    expect(optimisticUpdates.size).toBe(1)
    expect(optimisticUpdates.get('AAP-100')).toEqual(update)

    rollbackOptimisticUpdate('AAP-100')

    ;({ optimisticUpdates } = useBoardStore.getState())
    expect(optimisticUpdates.size).toBe(0)
    expect(optimisticUpdates.has('AAP-100')).toBe(false)
  })

  // -----------------------------------------------------------------------
  // Drag state
  // -----------------------------------------------------------------------

  it('startDrag and endDrag update drag state correctly', () => {
    const { startDrag, endDrag } = useBoardStore.getState()

    startDrag('AAP-200', 'To Do')

    let { dragState } = useBoardStore.getState()
    expect(dragState.isDragging).toBe(true)
    expect(dragState.draggedIssueKey).toBe('AAP-200')
    expect(dragState.sourceColumn).toBe('To Do')

    endDrag()

    ;({ dragState } = useBoardStore.getState())
    expect(dragState.isDragging).toBe(false)
    expect(dragState.draggedIssueKey).toBeNull()
    expect(dragState.sourceColumn).toBeNull()
  })

  // -----------------------------------------------------------------------
  // Multiple optimistic updates
  // -----------------------------------------------------------------------

  it('supports multiple concurrent optimistic updates', () => {
    const { applyOptimisticUpdate, rollbackOptimisticUpdate } = useBoardStore.getState()

    applyOptimisticUpdate({
      issueKey: 'AAP-1',
      targetStatusId: 's2',
      originalStatusId: 's1',
      timestamp: Date.now(),
    })

    applyOptimisticUpdate({
      issueKey: 'AAP-2',
      targetStatusId: 's3',
      originalStatusId: 's1',
      timestamp: Date.now(),
    })

    let { optimisticUpdates } = useBoardStore.getState()
    expect(optimisticUpdates.size).toBe(2)

    rollbackOptimisticUpdate('AAP-1')

    ;({ optimisticUpdates } = useBoardStore.getState())
    expect(optimisticUpdates.size).toBe(1)
    expect(optimisticUpdates.has('AAP-2')).toBe(true)
  })
})
