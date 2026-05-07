import { Link } from '@tanstack/react-router'
import { ChevronDown, Kanban, LayoutDashboard, ListChecks, Star } from 'lucide-react'
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
  const starredIds = useBoardPrefsStore((s) => s.starredBoardIds)
  const toggleStar = useBoardPrefsStore((s) => s.toggleStar)
  const [showAll, setShowAll] = useState(false)

  const starredSet = useMemo(() => new Set(starredIds), [starredIds])
  const recentIdMap = useMemo(() => new Map(recentBoards.map((r) => [r.id, r.lastVisited])), [recentBoards])

  const starred = useMemo(() => boards.filter((b) => starredSet.has(b.id)), [boards, starredSet])
  const recentOnly = useMemo(
    () =>
      boards
        .filter((b) => !starredSet.has(b.id) && recentIdMap.has(b.id))
        .sort((a, b) => {
          const aTime = recentIdMap.get(a.id) ?? 0
          const bTime = recentIdMap.get(b.id) ?? 0
          return bTime - aTime
        }),
    [boards, starredSet, recentIdMap],
  )
  const other = useMemo(
    () =>
      boards
        .filter((b) => !starredSet.has(b.id) && !recentIdMap.has(b.id))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [boards, starredSet, recentIdMap],
  )

  const remaining = [...recentOnly, ...other]
  const limitedRemaining = showAll ? remaining : remaining.slice(0, INITIAL_LIMIT)
  const hasMore = remaining.length > INITIAL_LIMIT

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Select a Board</h1>
        <p className="text-sm text-muted-foreground">Choose a board to view. Star boards to keep them at the top.</p>
      </div>

      {starred.length > 0 && (
        <BoardSection title="Starred" boards={starred} starredSet={starredSet} onToggleStar={toggleStar} />
      )}

      {recentOnly.length > 0 && !showAll && (
        <BoardSection title="Recent" boards={recentOnly} starredSet={starredSet} onToggleStar={toggleStar} />
      )}

      {(showAll ? remaining.length > 0 : other.length > 0) && (
        <BoardSection
          title={starred.length > 0 || recentOnly.length > 0 ? 'Other Boards' : 'Boards'}
          boards={
            showAll ? limitedRemaining : other.slice(0, Math.max(1, INITIAL_LIMIT - starred.length - recentOnly.length))
          }
          starredSet={starredSet}
          onToggleStar={toggleStar}
        />
      )}

      {hasMore && !showAll && (
        <div className="text-center">
          <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={() => setShowAll(true)}>
            <ChevronDown className="h-3.5 w-3.5" />
            Show all {boards.length} boards
          </Button>
        </div>
      )}
    </div>
  )
}

function BoardSection({
  title,
  boards,
  starredSet,
  onToggleStar,
}: {
  title: string
  boards: JiraBoard[]
  starredSet: Set<number>
  onToggleStar: (id: number) => void
}) {
  return (
    <div>
      <h2 className="mb-2 text-sm font-medium text-muted-foreground">{title}</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {boards.map((board) => (
          <BoardCard key={board.id} board={board} isStarred={starredSet.has(board.id)} onToggleStar={onToggleStar} />
        ))}
      </div>
    </div>
  )
}

function BoardCard({
  board,
  isStarred,
  onToggleStar,
}: {
  board: JiraBoard
  isStarred: boolean
  onToggleStar: (id: number) => void
}) {
  const Icon = BOARD_TYPE_ICONS[board.type] ?? LayoutDashboard
  return (
    <div className="relative">
      <Link to="/board/$boardId" params={{ boardId: String(board.id) }} className="block">
        <Card className="transition-colors hover:border-primary/50 hover:bg-accent/50">
          <CardContent className="flex items-start gap-3 p-4 pr-9">
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
      <button
        type="button"
        className="absolute right-3 top-3 rounded p-1 transition-colors hover:bg-accent"
        onClick={(e) => {
          e.preventDefault()
          onToggleStar(board.id)
        }}
        title={isStarred ? 'Unstar board' : 'Star board'}
      >
        <Star className={`h-3.5 w-3.5 ${isStarred ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`} />
      </button>
    </div>
  )
}
