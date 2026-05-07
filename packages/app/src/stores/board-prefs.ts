import { create } from 'zustand'

interface BoardPrefsStore {
  lastBoardId: number | null
  setLastBoard: (id: number) => void
}

const STORAGE_KEY = 'aegis_board_prefs'

function loadLastBoardId(): number | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return typeof parsed.lastBoardId === 'number' ? parsed.lastBoardId : null
  } catch {
    return null
  }
}

function persist(lastBoardId: number | null) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ lastBoardId }))
  } catch {
    /* noop */
  }
}

export const useBoardPrefsStore = create<BoardPrefsStore>((set) => ({
  lastBoardId: loadLastBoardId(),

  setLastBoard: (id) => {
    set({ lastBoardId: id })
    persist(id)
  },
}))
