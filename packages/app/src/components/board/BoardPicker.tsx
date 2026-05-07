import { Link } from '@tanstack/react-router'
import { ChevronDown, Kanban, LayoutDashboard, ListChecks } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import type { JiraBoard } from '@/lib/jira/types'
import { useBoardPrefsStore } from '@/stores/board-prefs'

interface BoardPickerProps {
  boards: JiraBoard[]
}

const BOARD_TYPE_ICONS = {
  kanban: Kanban,
  scrum: ListChecks,
  simple: LayoutDashboard,
} as const

const INITIAL_LIMIT = 6

export function BoardPicker({ boards }: BoardPickerProps) {
  const recentBoards = useBoardPrefsStore((s) => s.recentBoards)
  const [showAll, setShowAll] = useState(false)

  // Sort: recently used boards first, then alphabetical
  const sorted = useMemo(() => {
    const recentIds = new Map(recentBoards.map((r) => [r.id, r.lastVisited]))
    return [...boards].sort((a, b) => {
      const aRecent = recentIds.get(a.id) ?? 0
      const bRecent = recentIds.get(b.id) ?? 0
      if (aRecent !== bRecent) return bRecent - aRecent
      return a.name.localeCompare(b.name)
    })
  }, [boards, recentBoards])

  const hasRecent = recentBoards.length > 0
  const recentIds = new Set(recentBoards.map((r) => r.id))
  const recentSorted = sorted.filter((b) => recentIds.has(b.id))
  const otherSorted = sorted.filter((b) => !recentIds.has(b.id))

  const displayBoards = showAll ? sorted : sorted.slice(0, INITIAL_LIMIT)
  const hasMore = sorted.length > INITIAL_LIMIT

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Select a Board</h1>
        <p className="text-sm text-muted-foreground">
          Choose a board to view. Your selection will be remembered for next time.
        </p>
      </div>

      {/* Recent boards section */}
      {hasRecent && recentSorted.length > 0 && !showAll && (
        <div>
          <h2 className="mb-2 text-sm font-medium text-muted-foreground">Recent</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {recentSorted.map((board) => (
              <BoardCard key={board.id} board={board} />
            ))}
          </div>
        </div>
      )}

      {/* All boards (or remaining boards if recent section shown) */}
      {showAll ? (
        <div>
          <h2 className="mb-2 text-sm font-medium text-muted-foreground">All Boards</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {displayBoards.map((board) => (
              <BoardCard key={board.id} board={board} />
            ))}
          </div>
        </div>
      ) : (
        otherSorted.length > 0 && (
          <div>
            <h2 className="mb-2 text-sm font-medium text-muted-foreground">{hasRecent ? 'Other Boards' : 'Boards'}</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {(hasRecent ? otherSorted : displayBoards.filter((b) => !recentIds.has(b.id)))
                .slice(0, INITIAL_LIMIT - recentSorted.length)
                .map((board) => (
                  <BoardCard key={board.id} board={board} />
                ))}
            </div>
          </div>
        )
      )}

      {hasMore && !showAll && (
        <div className="text-center">
          <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={() => setShowAll(true)}>
            <ChevronDown className="h-3.5 w-3.5" />
            Show all {sorted.length} boards
          </Button>
        </div>
      )}
    </div>
  )
}

function BoardCard({ board }: { board: JiraBoard }) {
  const Icon = BOARD_TYPE_ICONS[board.type] ?? LayoutDashboard
  return (
    <Link to="/board/$boardId" params={{ boardId: String(board.id) }} className="block">
      <Card className="transition-colors hover:border-primary/50 hover:bg-accent/50">
        <CardContent className="flex items-start gap-3 p-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <Icon className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">{board.name}</p>
            <div className="mt-1 flex items-center gap-2">
              <Badge variant="outline" className="text-[10px] capitalize">
                {board.type}
              </Badge>
              {board.location?.projectKey && (
                <span className="text-[10px] text-muted-foreground">{board.location.projectKey}</span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
