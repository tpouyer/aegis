/**
 * Zustand store for toast notifications.
 *
 * Provides a simple API for showing success, error, and info toasts.
 * Toasts auto-dismiss after a configurable duration (default 5 seconds).
 */

import { create } from 'zustand'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ToastType = 'success' | 'error' | 'info'

export interface ToastMessage {
  id: string
  type: ToastType
  title: string
  description?: string
  /** Duration in milliseconds before auto-dismiss (default 5000) */
  duration?: number
}

export interface ToastState {
  toasts: ToastMessage[]
}

export interface ToastActions {
  addToast: (toast: Omit<ToastMessage, 'id'>) => string
  removeToast: (id: string) => void
  clearToasts: () => void
}

export type ToastStore = ToastState & ToastActions

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

let toastCounter = 0
const timeoutMap = new Map<string, ReturnType<typeof setTimeout>>()

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],

  addToast: (toast) => {
    const id = `toast-${++toastCounter}-${Date.now()}`
    const newToast: ToastMessage = { ...toast, id }

    set((state) => ({
      toasts: [...state.toasts, newToast],
    }))

    const duration = toast.duration ?? 5000
    const timeoutId = setTimeout(() => {
      timeoutMap.delete(id)
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      }))
    }, duration)
    timeoutMap.set(id, timeoutId)

    return id
  },

  removeToast: (id) => {
    const timeoutId = timeoutMap.get(id)
    if (timeoutId) {
      clearTimeout(timeoutId)
      timeoutMap.delete(id)
    }
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }))
  },

  clearToasts: () => {
    for (const timeoutId of timeoutMap.values()) {
      clearTimeout(timeoutId)
    }
    timeoutMap.clear()
    set({ toasts: [] })
  },
}))

// ---------------------------------------------------------------------------
// Convenience helpers (can be used outside of React components)
// ---------------------------------------------------------------------------

export const toast = {
  success: (title: string, description?: string) =>
    useToastStore.getState().addToast({ type: 'success', title, description }),
  error: (title: string, description?: string) =>
    useToastStore.getState().addToast({ type: 'error', title, description }),
  info: (title: string, description?: string) =>
    useToastStore.getState().addToast({ type: 'info', title, description }),
}
