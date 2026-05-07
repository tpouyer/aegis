/**
 * Zustand store for kanban board UI state.
 *
 * Manages drag-and-drop state, active filters, and optimistic updates
 * for issue transitions. Server data (issues, board config) lives in
 * TanStack Query — this store handles only transient UI concerns.
 *
 * See design doc section 5.4 for the optimistic update pattern.
 */

import { create } from 'zustand';
import type { BoardFilters } from '@/lib/jira/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DragState {
  isDragging: boolean;
  sourceColumn: string | null;
  targetColumn: string | null;
  draggedIssueKey: string | null;
}

export interface OptimisticUpdate {
  issueKey: string;
  /** The status ID the issue is optimistically moved to */
  targetStatusId: string;
  /** The original status ID for rollback */
  originalStatusId: string;
  /** Timestamp for ordering / staleness checks */
  timestamp: number;
}

export interface BoardState {
  dragState: DragState;
  filters: BoardFilters;
  optimisticUpdates: Map<string, OptimisticUpdate>;
}

export interface BoardActions {
  startDrag: (issueKey: string, sourceColumn: string) => void;
  endDrag: () => void;
  setFilter: <K extends keyof BoardFilters>(key: K, value: BoardFilters[K]) => void;
  clearFilters: () => void;
  applyOptimisticUpdate: (update: OptimisticUpdate) => void;
  rollbackOptimisticUpdate: (issueKey: string) => void;
}

export type BoardStore = BoardState & BoardActions;

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

const initialDragState: DragState = {
  isDragging: false,
  sourceColumn: null,
  targetColumn: null,
  draggedIssueKey: null,
};

const initialFilters: BoardFilters = {
  assignee: null,
  component: null,
  priority: null,
  text: null,
  issueType: null,
};

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useBoardStore = create<BoardStore>((set) => ({
  // State
  dragState: { ...initialDragState },
  filters: { ...initialFilters },
  optimisticUpdates: new Map(),

  // Actions
  startDrag: (issueKey, sourceColumn) =>
    set({
      dragState: {
        isDragging: true,
        sourceColumn,
        targetColumn: null,
        draggedIssueKey: issueKey,
      },
    }),

  endDrag: () =>
    set({
      dragState: { ...initialDragState },
    }),

  setFilter: (key, value) =>
    set((state) => ({
      filters: { ...state.filters, [key]: value },
    })),

  clearFilters: () =>
    set({
      filters: { ...initialFilters },
    }),

  applyOptimisticUpdate: (update) =>
    set((state) => {
      const next = new Map(state.optimisticUpdates);
      next.set(update.issueKey, update);
      return { optimisticUpdates: next };
    }),

  rollbackOptimisticUpdate: (issueKey) =>
    set((state) => {
      const next = new Map(state.optimisticUpdates);
      next.delete(issueKey);
      return { optimisticUpdates: next };
    }),
}));
