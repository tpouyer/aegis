# Proposal: Consolidate Theme State Management

## Type: fix
## Source: UAT-1 U4, UAT-1 P2, UAT-5 P8
## Problem: Theme toggle exists in three places (Header, Settings, Command Palette) with independent state management. Toggling in one doesn't reflect in others. Command palette uses raw DOM manipulation.
## Solution:
Create a shared Zustand store for theme:

```tsx
// src/stores/theme.ts
export const useThemeStore = create<{ isDark: boolean; toggle: () => void }>((set) => ({
  isDark: typeof document !== 'undefined' && document.documentElement.classList.contains('dark'),
  toggle: () => set((state) => {
    const next = !state.isDark
    document.documentElement.classList.toggle('dark', next)
    localStorage.setItem('aegis_theme', next ? 'dark' : 'light')
    return { isDark: next }
  }),
}))
```

Replace all three implementations with this store:
1. `Header.tsx` → `const { isDark, toggle } = useThemeStore()`
2. `settings.tsx` → remove local `useTheme()`, use store
3. `default-commands.ts` → `useThemeStore.getState().toggle()`

## Effort: S
## Files affected:
- `src/stores/theme.ts` (new)
- `src/components/shared/Header.tsx`
- `src/routes/settings.tsx`
- `src/lib/commands/default-commands.ts`
## Test plan:
- Toggle theme in Header → Settings shows correct state
- Toggle via Cmd+K "Toggle Theme" → Header icon updates
- Refresh page → theme persists from localStorage
