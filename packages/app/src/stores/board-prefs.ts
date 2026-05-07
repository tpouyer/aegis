import { create } from 'zustand'

export interface RecentBoard {
  id: number
  name: string
  projectKey?: string
  lastVisited: number
}

interface BoardPrefsStore {
  lastBoardId: number | null
  recentBoards: RecentBoard[]
  starredBoardIds: number[]
  setLastBoard: (id: number, name?: string, projectKey?: string) => void
  clearLastBoard: () => void
  toggleStar: (boardId: number) => void
  isBoardStarred: (boardId: number) => boolean
}

const STORAGE_KEY = 'aegis_board_prefs'
const MAX_RECENT = 8

interface PersistedState {
  lastBoardId: number | null
  recentBoards?: RecentBoard[]
  starredBoardIds?: number[]
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

    setLastBoard: (id, name, projectKey) => {
      const { recentBoards, starredBoardIds } = get()
      const now = Date.now()
      const filtered = recentBoards.filter((b) => b.id !== id)
      const entry: RecentBoard = { id, name: name ?? `Board ${id}`, projectKey, lastVisited: now }
      const updated = [entry, ...filtered].slice(0, MAX_RECENT)
      const state = { lastBoardId: id, recentBoards: updated, starredBoardIds }
      set(state)
      persist(state)
    },

    clearLastBoard: () => {
      const { recentBoards, starredBoardIds } = get()
      const state = { lastBoardId: null, recentBoards, starredBoardIds }
      set(state)
      persist(state)
    },

    toggleStar: (boardId) => {
      const { lastBoardId, recentBoards, starredBoardIds } = get()
      const isStarred = starredBoardIds.includes(boardId)
      const updated = isStarred ? starredBoardIds.filter((id) => id !== boardId) : [...starredBoardIds, boardId]
      const state = { lastBoardId, recentBoards, starredBoardIds: updated }
      set(state)
      persist(state)
    },

    isBoardStarred: (boardId) => get().starredBoardIds.includes(boardId),
  }
})
