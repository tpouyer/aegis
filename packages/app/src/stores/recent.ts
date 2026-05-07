/**
 * Zustand store for recently visited issues.
 *
 * Persists the last MAX_RECENT issues to localStorage so the landing
 * page can show a "Recent Issues" grid for returning users.
 */

import { create } from 'zustand'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RecentIssue {
  key: string
  summary: string
  lastVisited: number
  lastView: 'chat' | 'ide'
}

export interface RecentStore {
  issues: RecentIssue[]
  recordVisit: (key: string, summary: string, view: 'chat' | 'ide') => void
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'aegis_recent_issues'
const MAX_RECENT = 8

// ---------------------------------------------------------------------------
// localStorage helpers
// ---------------------------------------------------------------------------

function loadFromStorage(): RecentIssue[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed as RecentIssue[]
  } catch {
    return []
  }
}

function saveToStorage(issues: RecentIssue[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(issues))
  } catch {
    // localStorage may be full or unavailable — silently ignore
  }
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useRecentStore = create<RecentStore>((set) => ({
  issues: loadFromStorage(),

  recordVisit: (key, summary, view) =>
    set((state) => {
      const now = Date.now()

      // Remove existing entry for this key (if any)
      const filtered = state.issues.filter((i) => i.key !== key)

      // Prepend the new/updated entry
      const updated: RecentIssue[] = [{ key, summary, lastVisited: now, lastView: view }, ...filtered].slice(
        0,
        MAX_RECENT,
      )

      saveToStorage(updated)
      return { issues: updated }
    }),
}))
