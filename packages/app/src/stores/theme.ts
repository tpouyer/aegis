import { create } from 'zustand'

interface ThemeState {
  isDark: boolean
  toggle: () => void
}

function getInitialTheme(): boolean {
  if (typeof document === 'undefined') return false
  try {
    const stored = localStorage.getItem('aegis_theme')
    if (stored) return stored === 'dark'
  } catch {
    /* localStorage may not be available in test/SSR */
  }
  return document.documentElement.classList.contains('dark')
}

export const useThemeStore = create<ThemeState>((set) => ({
  isDark: getInitialTheme(),
  toggle: () =>
    set((state) => {
      const next = !state.isDark
      if (typeof document !== 'undefined') {
        document.documentElement.classList.toggle('dark', next)
      }
      try {
        localStorage.setItem('aegis_theme', next ? 'dark' : 'light')
      } catch {
        /* noop in test */
      }
      return { isDark: next }
    }),
}))
