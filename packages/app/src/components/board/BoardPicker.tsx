import { Link } from '@tanstack/react-router'
import { ChevronDown, Filter, Kanban, LayoutDashboard, ListChecks, Loader2, Search, Star, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import { useProjectSearch } from '@/lib/jira/queries'
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

const PROJECT_TYPE_LABELS: Record<string, string> = {
  software: 'Software',
  business: 'Business',
  service_desk: 'Service Desk',
}

const INITIAL_LIMIT = 6

export function BoardPicker({ boards }: BoardPickerProps) {
  const recentBoards = useBoardPrefsStore((s) => s.recentBoards)
  const starredIds = useBoardPrefsStore((s) => s.starredBoardIds)
  const toggleStar = useBoardPrefsStore((s) => s.toggleStar)
  const [showAll, setShowAll] = useState(false)
  const [textFilter, setTextFilter] = useState('')
  const [spaceFilter, setSpaceFilter] = useState<string | null>(null)
  const [spaceFilterName, setSpaceFilterName] = useState<string | null>(null)
  const [typeFilter, setTypeFilter] = useState<string | null>(null)
  const [projectTypeFilter, setProjectTypeFilter] = useState<string | null>(null)

  const starredSet = useMemo(() => new Set(starredIds), [starredIds])
  const recentIdMap = useMemo(() => new Map(recentBoards.map((r) => [r.id, r.lastVisited])), [recentBoards])

  // Extract unique filter options from available boards
  const boardTypes = useMemo(() => {
    const types = new Set(boards.map((b) => b.type))
    return Array.from(types).sort()
  }, [boards])

  const projectTypes = useMemo(() => {
    const types = new Set<string>()
    for (const b of boards) {
      if (b.location?.projectTypeKey) types.add(b.location.projectTypeKey)
    }
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
          b.location?.projectKey.toLowerCase().includes(lower) ||
          b.location?.displayName?.toLowerCase().includes(lower),
      )
    }
    if (spaceFilter) {
      result = result.filter((b) => b.location?.projectKey === spaceFilter)
    }
    if (typeFilter) {
      result = result.filter((b) => b.type === typeFilter)
    }
    if (projectTypeFilter) {
      result = result.filter((b) => b.location?.projectTypeKey === projectTypeFilter)
    }
    return result
  }, [boards, textFilter, spaceFilter, typeFilter, projectTypeFilter])

  const hasActiveFilters = textFilter || spaceFilter || typeFilter || projectTypeFilter

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

  const clearAllFilters = () => {
    setTextFilter('')
    setSpaceFilter(null)
    setSpaceFilterName(null)
    setTypeFilter(null)
    setProjectTypeFilter(null)
  }

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

        <SearchableFilter
          value={spaceFilter}
          selectedName={spaceFilterName}
          onSelect={(key, name) => {
            setSpaceFilter(key)
            setSpaceFilterName(name)
          }}
        />

        {boardTypes.length > 1 && (
          <FilterDropdown
            label="Board Type"
            value={typeFilter}
            options={boardTypes.map((t) => ({ id: t, label: t }))}
            onSelect={setTypeFilter}
            capitalize
          />
        )}

        {projectTypes.length > 1 && (
          <FilterDropdown
            label="Project Type"
            value={projectTypeFilter}
            options={projectTypes.map((t) => ({
              id: t,
              label: PROJECT_TYPE_LABELS[t] ?? t,
            }))}
            onSelect={setProjectTypeFilter}
          />
        )}

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1 text-xs text-muted-foreground"
            onClick={clearAllFilters}
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

// ---------------------------------------------------------------------------
// Filter dropdown (reusable)
// ---------------------------------------------------------------------------

function FilterDropdown({
  label,
  value,
  options,
  onSelect,
  capitalize: cap,
}: {
  label: string
  value: string | null
  options: Array<{ id: string; label: string; detail?: string }>
  onSelect: (value: string | null) => void
  capitalize?: boolean
}) {
  const selectedLabel = value ? (options.find((o) => o.id === value)?.label ?? value) : null
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={value ? 'secondary' : 'outline'}
          size="sm"
          className={`h-8 gap-1 text-xs ${cap ? 'capitalize' : ''}`}
        >
          {selectedLabel ?? label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-64 overflow-y-auto">
        <DropdownMenuLabel className="text-xs">{label}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {value && (
          <>
            <DropdownMenuItem onClick={() => onSelect(null)} className="text-xs text-muted-foreground">
              Clear selection
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        {options.map((o) => (
          <DropdownMenuItem key={o.id} onClick={() => onSelect(o.id)} className={`text-xs ${cap ? 'capitalize' : ''}`}>
            {o.label}
            {o.detail && <span className="ml-auto text-[10px] text-muted-foreground">{o.detail}</span>}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ---------------------------------------------------------------------------
// Searchable space filter (debounced API search)
// ---------------------------------------------------------------------------

function useDebouncedValue(value: string, delayMs: number): string {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])
  return debounced
}

function SearchableFilter({
  value,
  selectedName,
  onSelect,
}: {
  value: string | null
  selectedName: string | null
  onSelect: (projectKey: string | null, projectName: string | null) => void
}) {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const debouncedSearch = useDebouncedValue(search, 400)
  const { data: projects, isLoading } = useProjectSearch(debouncedSearch)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = useCallback(
    (key: string, name: string) => {
      onSelect(key, name)
      setSearch('')
      setOpen(false)
    },
    [onSelect],
  )

  if (value) {
    return (
      <Button variant="secondary" size="sm" className="h-8 gap-1 text-xs" onClick={() => onSelect(null, null)}>
        {selectedName ?? value}
        <X className="h-3 w-3" />
      </Button>
    )
  }

  const showDropdown = open && debouncedSearch.length >= 2

  return (
    <div ref={containerRef} className="relative">
      <Input
        ref={inputRef}
        placeholder="Space"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value)
          setOpen(true)
        }}
        onFocus={() => {
          if (search.length >= 2) setOpen(true)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setOpen(false)
            inputRef.current?.blur()
          }
        }}
        className="h-8 w-36 text-xs"
        aria-label="Filter by space"
      />
      {showDropdown && (
        <div className="absolute left-0 top-full z-50 mt-1 w-56 rounded-md border border-border bg-card shadow-lg">
          {isLoading && (
            <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Searching...
            </div>
          )}
          {!isLoading && projects && projects.length > 0 && (
            <div className="max-h-48 overflow-y-auto">
              {projects.map((p) => (
                <button
                  type="button"
                  key={p.key}
                  className="flex w-full items-center px-3 py-1.5 text-left text-xs transition-colors hover:bg-accent"
                  onClick={() => handleSelect(p.key, p.name)}
                >
                  <span className="flex-1 truncate">{p.name}</span>
                  <span className="ml-2 text-[10px] text-muted-foreground">{p.key}</span>
                </button>
              ))}
            </div>
          )}
          {!isLoading && projects && projects.length === 0 && (
            <div className="px-3 py-2 text-xs text-muted-foreground">No spaces found</div>
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Board sections and cards
// ---------------------------------------------------------------------------

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
                {board.location?.projectTypeKey && (
                  <span className="text-[10px] text-muted-foreground">
                    {PROJECT_TYPE_LABELS[board.location.projectTypeKey] ?? board.location.projectTypeKey}
                  </span>
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
