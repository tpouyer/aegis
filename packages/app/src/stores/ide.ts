/**
 * Zustand store for IDE UI state.
 *
 * Manages open tabs, active file, explorer expansion state,
 * diff view toggle, and commit message — all the ephemeral UI
 * state that doesn't belong in the VFS itself.
 */

import { create } from 'zustand'

export interface IDETab {
  repoKey: string
  path: string
  isDirty: boolean
}

interface IDEState {
  activeRepo: string | null
  openTabs: IDETab[]
  activeTab: number
  explorerExpandedPaths: Set<string>
  showDiff: boolean
  commitMessage: string

  // Actions
  openFile: (repoKey: string, path: string) => void
  closeTab: (index: number) => void
  setActiveTab: (index: number) => void
  toggleExplorerPath: (path: string) => void
  setCommitMessage: (msg: string) => void
  toggleDiffView: () => void
  markTabDirty: (repoKey: string, path: string, isDirty: boolean) => void
  setActiveRepo: (repoKey: string) => void
}

export const useIDEStore = create<IDEState>((set, get) => ({
  activeRepo: null,
  openTabs: [],
  activeTab: -1,
  explorerExpandedPaths: new Set<string>(),
  showDiff: false,
  commitMessage: '',

  openFile: (repoKey: string, path: string) => {
    const { openTabs } = get()

    // Check if already open
    const existingIndex = openTabs.findIndex((t) => t.repoKey === repoKey && t.path === path)

    if (existingIndex >= 0) {
      set({ activeTab: existingIndex })
      return
    }

    // Open a new tab
    const newTab: IDETab = { repoKey, path, isDirty: false }
    set({
      openTabs: [...openTabs, newTab],
      activeTab: openTabs.length,
    })
  },

  closeTab: (index: number) => {
    const { openTabs, activeTab } = get()
    const newTabs = openTabs.filter((_, i) => i !== index)

    let newActiveTab = activeTab
    if (index <= activeTab) {
      newActiveTab = Math.max(0, activeTab - 1)
    }
    if (newTabs.length === 0) {
      newActiveTab = -1
    }

    set({ openTabs: newTabs, activeTab: newActiveTab })
  },

  setActiveTab: (index: number) => {
    set({ activeTab: index })
  },

  toggleExplorerPath: (path: string) => {
    const expanded = new Set(get().explorerExpandedPaths)
    if (expanded.has(path)) {
      expanded.delete(path)
    } else {
      expanded.add(path)
    }
    set({ explorerExpandedPaths: expanded })
  },

  setCommitMessage: (msg: string) => {
    set({ commitMessage: msg })
  },

  toggleDiffView: () => {
    set((state) => ({ showDiff: !state.showDiff }))
  },

  markTabDirty: (repoKey: string, path: string, isDirty: boolean) => {
    set((state) => ({
      openTabs: state.openTabs.map((t) => (t.repoKey === repoKey && t.path === path ? { ...t, isDirty } : t)),
    }))
  },

  setActiveRepo: (repoKey: string) => {
    set({ activeRepo: repoKey })
  },
}))
