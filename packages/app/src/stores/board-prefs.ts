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
  setLastBoard: (id: number, name?: string, projectKey?: string) => void
  clearLastBoard: () => void
}

const STORAGE_KEY = 'aegis_board_prefs'
const MAX_RECENT = 8

interface PersistedState {
  lastBoardId: number | null
  recentBoards?: RecentBoard[]
}

function loadFromStorage(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { lastBoardId: null }
    const parsed = JSON.parse(raw)
    return {
      lastBoardId: typeof parsed.lastBoardId === 'number' ? parsed.lastBoardId : null,
      recentBoards: Array.isArray(parsed.recentBoards) ? parsed.recentBoards : [],
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

    setLastBoard: (id, name, projectKey) => {
      const { recentBoards } = get()
      const now = Date.now()
      const filtered = recentBoards.filter((b) => b.id !== id)
      const entry: RecentBoard = { id, name: name ?? `Board ${id}`, projectKey, lastVisited: now }
      const updated = [entry, ...filtered].slice(0, MAX_RECENT)
      const state = { lastBoardId: id, recentBoards: updated }
      set(state)
      persist(state)
    },

    clearLastBoard: () => {
      const { recentBoards } = get()
      const state = { lastBoardId: null, recentBoards }
      set(state)
      persist(state)
    },
  }
})
