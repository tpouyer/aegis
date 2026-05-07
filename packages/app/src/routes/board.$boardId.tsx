import { useEffect } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { BoardView } from '@/components/board/BoardView'
import { useShortcuts, shortcutRegistry } from '@/lib/shortcuts'
import { useBoardStore } from '@/stores/board'

export const Route = createFileRoute('/board/$boardId')({
  component: BoardPage,
})

function BoardPage() {
  const { boardId } = Route.useParams()
  const numericBoardId = Number(boardId)

  useEffect(() => { document.title = `Board ${boardId} — Aegis` }, [boardId])

  // Activate board-scope keyboard shortcut handling
  useShortcuts('board')

  // Register board-scoped shortcuts
  useEffect(() => {
    const unregisterJ = shortcutRegistry.register({
      key: 'j',
      scope: 'board',
      description: 'Focus next card',
      action: () => useBoardStore.getState().focusNextCard(),
    })

    const unregisterK = shortcutRegistry.register({
      key: 'k',
      scope: 'board',
      description: 'Focus previous card',
      action: () => useBoardStore.getState().focusPrevCard(),
    })

    const unregisterEnter = shortcutRegistry.register({
      key: 'Enter',
      scope: 'board',
      description: 'Open focused card detail',
      action: () => {
        // BoardView listens to focusedCardIndex and opens detail;
        // this is a marker — BoardView wires it via onCardClick.
        // We dispatch a custom event that BoardView can handle.
        document.dispatchEvent(
          new CustomEvent('aegis:open-focused-card'),
        )
      },
      when: () => useBoardStore.getState().focusedCardIndex >= 0,
    })

    const unregisterF = shortcutRegistry.register({
      key: 'f',
      scope: 'board',
      description: 'Focus filter bar',
      action: () => {
        const filterInput = document.querySelector<HTMLInputElement>(
          '[data-shortcut-target="filter-bar"]',
        )
        filterInput?.focus()
      },
    })

    const unregisterEscape = shortcutRegistry.register({
      key: 'Escape',
      scope: 'board',
      description: 'Close card detail / clear focus',
      action: () => {
        document.dispatchEvent(
          new CustomEvent('aegis:close-card-detail'),
        )
        useBoardStore.getState().clearFocus()
      },
    })

    return () => {
      unregisterJ()
      unregisterK()
      unregisterEnter()
      unregisterF()
      unregisterEscape()
    }
  }, [])

  if (Number.isNaN(numericBoardId)) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <p className="text-sm text-muted-foreground">
          Invalid board ID: <code className="rounded bg-muted px-2 py-0.5 text-sm">{boardId}</code>
        </p>
      </div>
    )
  }

  return <BoardView boardId={numericBoardId} />
}
