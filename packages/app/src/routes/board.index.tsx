import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { LayoutDashboard } from 'lucide-react'
import { useEffect } from 'react'
import { BoardPicker } from '@/components/board/BoardPicker'
import { BoardSkeleton } from '@/components/board/BoardSkeleton'
import { EmptyState } from '@/components/shared/EmptyState'
import { authManager } from '@/lib/auth/manager'
import { useBoards } from '@/lib/jira/queries'
import { useBoardPrefsStore } from '@/stores/board-prefs'

export const Route = createFileRoute('/board/')({
  component: BoardIndexPage,
})

function BoardIndexPage() {
  const navigate = useNavigate()
  const lastBoardId = useBoardPrefsStore((s) => s.lastBoardId)

  useEffect(() => {
    document.title = 'Boards — Aegis'
  }, [])

  // Redirect to last-used board immediately
  useEffect(() => {
    if (lastBoardId !== null) {
      navigate({ to: '/board/$boardId', params: { boardId: String(lastBoardId) }, replace: true })
    }
  }, [lastBoardId, navigate])

  // Only fetch boards if we don't have a lastBoardId (otherwise we're redirecting)
  const { data: boards, isLoading, error } = useBoards({ enabled: lastBoardId === null })

  // While redirecting, show skeleton
  if (lastBoardId !== null) {
    return <BoardSkeleton />
  }

  if (isLoading) {
    return <BoardSkeleton />
  }

  const jiraConfigured = !!localStorage.getItem('aegis_jira_config')
  if (!authManager.isConnected('atlassian') && !jiraConfigured) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <EmptyState
          variant="auth-required"
          icon={LayoutDashboard}
          title="Connect to Jira to see your boards"
          description="Go to Settings > Integrations and connect with a Jira API token."
          action={{
            label: 'Go to Settings',
            onClick: () => navigate({ to: '/settings' }),
          }}
        />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <EmptyState
          variant="error"
          title="Failed to load boards"
          description={error instanceof Error ? error.message : 'An unexpected error occurred.'}
        />
      </div>
    )
  }

  if (!boards || boards.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <EmptyState
          variant="no-data"
          icon={LayoutDashboard}
          title="No boards found"
          description="No boards are visible to your account. Check your Jira project permissions."
        />
      </div>
    )
  }

  return <BoardPicker boards={boards} />
}
