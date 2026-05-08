import { create } from 'zustand'

export interface RecentBoard {
  id: number
  name: string
  projectKey?: string
  lastVisited: number
}

export interface StarredBoard {
  id: number
  name: string
  type: string
  projectKey?: string
  projectName?: string
  projectTypeKey?: string
}

export interface PickerFilters {
  spaceFilter: string | null
  spaceFilterName: string | null
  typeFilter: string | null
  projectTypeFilter: string | null
}

interface BoardPrefsStore {
  lastBoardId: number | null
  recentBoards: RecentBoard[]
  starredBoardIds: number[]
  starredBoards: StarredBoard[]
  pickerFilters: PickerFilters
  setLastBoard: (id: number, name?: string, projectKey?: string) => void
  clearLastBoard: () => void
  toggleStar: (boardId: number, board?: StarredBoard) => void
  isBoardStarred: (boardId: number) => boolean
  setPickerFilters: (filters: Partial<PickerFilters>) => void
  clearPickerFilters: () => void
}

const STORAGE_KEY = 'aegis_board_prefs'
const MAX_RECENT = 8

const EMPTY_PICKER_FILTERS: PickerFilters = {
  spaceFilter: null,
  spaceFilterName: null,
  typeFilter: null,
  projectTypeFilter: null,
}

interface PersistedState {
  lastBoardId: number | null
  recentBoards?: RecentBoard[]
  starredBoardIds?: number[]
  starredBoards?: StarredBoard[]
  pickerFilters?: PickerFilters
}

function loadFromStorage(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { lastBoardId: null }
    const parsed = JSON.parse(raw)
    return {
      lastBoardId: typeof parsed.lastBoardId === 'number' ? parsed.lastBoardId : null,
      recentBoards: Array.isArray(parsed.recentBoards) ? parsed.recentBoards : [],
      starredBoardIds: Array.isArray(parsed.starredBoardIds) ? parsed.starredBoardIds : [],
      starredBoards: Array.isArray(parsed.starredBoards) ? parsed.starredBoards : [],
      pickerFilters: parsed.pickerFilters ?? EMPTY_PICKER_FILTERS,
    }
  } catch {
    return { lastBoardId: null }
  }
}

function persist(state: PersistedState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    /* noop */
  }
}

export const useBoardPrefsStore = create<BoardPrefsStore>((set, get) => {
  const initial = loadFromStorage()
  return {
    lastBoardId: initial.lastBoardId,
    recentBoards: initial.recentBoards ?? [],
    starredBoardIds: initial.starredBoardIds ?? [],
    starredBoards: initial.starredBoards ?? [],
    pickerFilters: initial.pickerFilters ?? EMPTY_PICKER_FILTERS,

    setLastBoard: (id, name, projectKey) => {
      const { recentBoards, starredBoardIds, starredBoards } = get()
      const now = Date.now()
      const filtered = recentBoards.filter((b) => b.id !== id)
      const entry: RecentBoard = { id, name: name ?? `Board ${id}`, projectKey, lastVisited: now }
      const updated = [entry, ...filtered].slice(0, MAX_RECENT)
      const state = { lastBoardId: id, recentBoards: updated, starredBoardIds, starredBoards }
      set(state)
      persist(state)
    },

    clearLastBoard: () => {
      const { recentBoards, starredBoardIds, starredBoards } = get()
      const state = { lastBoardId: null, recentBoards, starredBoardIds, starredBoards }
      set(state)
      persist(state)
    },

    toggleStar: (boardId, board) => {
      const { lastBoardId, recentBoards, starredBoardIds, starredBoards } = get()
      const isStarred = starredBoardIds.includes(boardId)
      const updatedIds = isStarred ? starredBoardIds.filter((id) => id !== boardId) : [...starredBoardIds, boardId]
      const updatedBoards = isStarred
        ? starredBoards.filter((b) => b.id !== boardId)
        : board
          ? [...starredBoards.filter((b) => b.id !== boardId), board]
          : starredBoards
      const state = { lastBoardId, recentBoards, starredBoardIds: updatedIds, starredBoards: updatedBoards }
      set(state)
      persist(state)
    },

    isBoardStarred: (boardId) => get().starredBoardIds.includes(boardId),

    setPickerFilters: (filters) => {
      const { lastBoardId, recentBoards, starredBoardIds, starredBoards, pickerFilters } = get()
      const updated = { ...pickerFilters, ...filters }
      const state = { lastBoardId, recentBoards, starredBoardIds, starredBoards, pickerFilters: updated }
      set({ pickerFilters: updated })
      persist(state)
    },

    clearPickerFilters: () => {
      const { lastBoardId, recentBoards, starredBoardIds, starredBoards } = get()
      const state = { lastBoardId, recentBoards, starredBoardIds, starredBoards, pickerFilters: EMPTY_PICKER_FILTERS }
      set({ pickerFilters: EMPTY_PICKER_FILTERS })
      persist(state)
    },
  }
})
