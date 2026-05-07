import { Link } from '@tanstack/react-router'
import { ChevronDown, Filter, Kanban, LayoutDashboard, ListChecks, Search, Star, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
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
  const [textFilter, setTextFilter] = useState('')
  const [projectFilter, setProjectFilter] = useState<string | null>(null)
  const [typeFilter, setTypeFilter] = useState<string | null>(null)

  const starredSet = useMemo(() => new Set(starredIds), [starredIds])
  const recentIdMap = useMemo(() => new Map(recentBoards.map((r) => [r.id, r.lastVisited])), [recentBoards])

  // Extract unique projects and types for filter dropdowns
  const projects = useMemo(() => {
    const seen = new Map<string, string>()
    for (const b of boards) {
      if (b.location?.projectKey && !seen.has(b.location.projectKey)) {
        seen.set(b.location.projectKey, b.location.projectName)
      }
    }
    return Array.from(seen.entries())
      .map(([key, name]) => ({ key, name }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [boards])

  const boardTypes = useMemo(() => {
    const types = new Set(boards.map((b) => b.type))
    return Array.from(types).sort()
  }, [boards])

  // Apply filters
  const filtered = useMemo(() => {
    let result = boards
    if (textFilter) {
      const lower = textFilter.toLowerCase()
      result = result.filter(
        (b) =>
          b.name.toLowerCase().includes(lower) ||
          b.location?.projectName.toLowerCase().includes(lower) ||
          b.location?.projectKey.toLowerCase().includes(lower),
      )
    }
    if (projectFilter) {
      result = result.filter((b) => b.location?.projectKey === projectFilter)
    }
    if (typeFilter) {
      result = result.filter((b) => b.type === typeFilter)
    }
    return result
  }, [boards, textFilter, projectFilter, typeFilter])

  const hasActiveFilters = textFilter || projectFilter || typeFilter

  // Split filtered boards into sections
  const starred = useMemo(() => filtered.filter((b) => starredSet.has(b.id)), [filtered, starredSet])
  const recentOnly = useMemo(
    () =>
      filtered
        .filter((b) => !starredSet.has(b.id) && recentIdMap.has(b.id))
        .sort((a, b) => (recentIdMap.get(b.id) ?? 0) - (recentIdMap.get(a.id) ?? 0)),
    [filtered, starredSet, recentIdMap],
  )
  const other = useMemo(
    () =>
      filtered
        .filter((b) => !starredSet.has(b.id) && !recentIdMap.has(b.id))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [filtered, starredSet, recentIdMap],
  )

  const remaining = [...recentOnly, ...other]
  const limitedRemaining = showAll || hasActiveFilters ? remaining : remaining.slice(0, INITIAL_LIMIT)
  const hasMore = !hasActiveFilters && remaining.length > INITIAL_LIMIT

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Select a Board</h1>
        <p className="text-sm text-muted-foreground">Choose a board to view. Star boards to keep them at the top.</p>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Filter boards..."
            value={textFilter}
            onChange={(e) => setTextFilter(e.target.value)}
            className="h-8 w-48 pl-8 text-xs"
            aria-label="Filter boards by name"
          />
        </div>
        {projects.length > 1 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant={projectFilter ? 'secondary' : 'outline'} size="sm" className="h-8 gap-1 text-xs">
                {projectFilter ? (projects.find((p) => p.key === projectFilter)?.name ?? projectFilter) : 'Project'}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="max-h-64 overflow-y-auto">
              <DropdownMenuLabel className="text-xs">Project</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {projectFilter && (
                <>
                  <DropdownMenuItem onClick={() => setProjectFilter(null)} className="text-xs text-muted-foreground">
                    Clear selection
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              {projects.map((p) => (
                <DropdownMenuItem key={p.key} onClick={() => setProjectFilter(p.key)} className="text-xs">
                  {p.name}
                  <span className="ml-auto text-[10px] text-muted-foreground">{p.key}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        {boardTypes.length > 1 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant={typeFilter ? 'secondary' : 'outline'} size="sm" className="h-8 gap-1 text-xs capitalize">
                {typeFilter ?? 'Type'}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuLabel className="text-xs">Board Type</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {typeFilter && (
                <>
                  <DropdownMenuItem onClick={() => setTypeFilter(null)} className="text-xs text-muted-foreground">
                    Clear selection
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              {boardTypes.map((t) => (
                <DropdownMenuItem key={t} onClick={() => setTypeFilter(t)} className="text-xs capitalize">
                  {t}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1 text-xs text-muted-foreground"
            onClick={() => {
              setTextFilter('')
              setProjectFilter(null)
              setTypeFilter(null)
            }}
          >
            <X className="h-3.5 w-3.5" />
            Clear
          </Button>
        )}
        <span className="text-xs text-muted-foreground">
          {filtered.length} of {boards.length} boards
        </span>
      </div>

      {/* Board sections */}
      {filtered.length === 0 && (
        <div className="py-12 text-center text-sm text-muted-foreground">No boards match your filters</div>
      )}

      {starred.length > 0 && (
        <BoardSection title="Starred" boards={starred} starredSet={starredSet} onToggleStar={toggleStar} />
      )}

      {recentOnly.length > 0 && !showAll && !hasActiveFilters && (
        <BoardSection title="Recent" boards={recentOnly} starredSet={starredSet} onToggleStar={toggleStar} />
      )}

      {limitedRemaining.length > 0 && (
        <BoardSection
          title={starred.length > 0 || (recentOnly.length > 0 && !hasActiveFilters) ? 'Other Boards' : 'Boards'}
          boards={limitedRemaining}
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
