import { useCallback, useEffect, useState } from 'react'
import { createRootRoute, Outlet, useNavigate } from '@tanstack/react-router'
import { Sidebar } from '@/components/shared/Sidebar'
import { Header } from '@/components/shared/Header'
import { ErrorBoundary } from '@/components/shared/ErrorBoundary'
import { Toaster } from '@/components/shared/Toaster'
import { CommandPalette } from '@/components/shared/CommandPalette'
import { ShortcutHelp } from '@/components/shared/ShortcutHelp'
import { registerDefaultCommands } from '@/lib/commands/default-commands'
import { useShortcuts, shortcutRegistry } from '@/lib/shortcuts'

export const Route = createRootRoute({
  component: RootLayout,
})

function RootLayout() {
  const [paletteOpen, setPaletteOpen] = useState(false)
  const navigate = useNavigate()

  // Activate global-scope keyboard shortcut handling
  useShortcuts('global')

  // Register default commands on mount
  useEffect(() => {
    const dispose = registerDefaultCommands((opts) => {
      navigate({ to: opts.to, params: opts.params } as Parameters<typeof navigate>[0])
    })
    return dispose
  }, [navigate])

  // Register global navigation shortcuts
  useEffect(() => {
    const unregisterGoBoard = shortcutRegistry.register({
      key: 'g b',
      scope: 'global',
      description: 'Go to board',
      action: () => navigate({ to: '/board/$boardId', params: { boardId: '1' } }),
    })

    const unregisterGoSettings = shortcutRegistry.register({
      key: 'g s',
      scope: 'global',
      description: 'Go to settings',
      action: () => navigate({ to: '/settings' }),
    })

    return () => {
      unregisterGoBoard()
      unregisterGoSettings()
    }
  }, [navigate])

  // Global Cmd+K / Ctrl+K handler
  const handleGlobalKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        // Don't capture when a Monaco editor has focus
        const active = document.activeElement
        if (active?.closest('.monaco-editor')) return

        e.preventDefault()
        setPaletteOpen((prev) => !prev)
      }
    },
    [],
  )

  useEffect(() => {
    document.addEventListener('keydown', handleGlobalKeyDown)
    return () => document.removeEventListener('keydown', handleGlobalKeyDown)
  }, [handleGlobalKeyDown])

  return (
    <ErrorBoundary>
      <div className="flex h-screen flex-col">
        <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-background focus:p-4 focus:text-foreground focus:shadow-lg">
          Skip to main content
        </a>
        <Header />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />
          <main id="main-content" className="flex-1 overflow-auto bg-background">
            <Outlet />
          </main>
        </div>
      </div>
      <Toaster />
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
      <ShortcutHelp />
    </ErrorBoundary>
  )
}
