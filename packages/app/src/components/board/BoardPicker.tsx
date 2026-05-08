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
import { useBoardSearch, useProjectSearch } from '@/lib/jira/queries'
import type { JiraBoard } from '@/lib/jira/types'
import type { StarredBoard } from '@/stores/board-prefs'
import { useBoardPrefsStore } from '@/stores/board-prefs'
import { StarredQuickAccess } from './StarredQuickAccess'

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

function useDebouncedValue(value: string, delayMs: number): string {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])
  return debounced
}

export function BoardPicker({ boards }: BoardPickerProps) {
  const recentBoards = useBoardPrefsStore((s) => s.recentBoards)
  const starredIds = useBoardPrefsStore((s) => s.starredBoardIds)
  const starredBoardData = useBoardPrefsStore((s) => s.starredBoards)
  const toggleStar = useBoardPrefsStore((s) => s.toggleStar)
  const pickerFilters = useBoardPrefsStore((s) => s.pickerFilters)
  const setPickerFilters = useBoardPrefsStore((s) => s.setPickerFilters)
  const clearPickerFilters = useBoardPrefsStore((s) => s.clearPickerFilters)
  const [showAll, setShowAll] = useState(false)

  // Board name search is transient — not persisted
  const [boardNameInput, setBoardNameInput] = useState('')

  // Persisted filter state
  const spaceFilter = pickerFilters.spaceFilter
  const spaceFilterName = pickerFilters.spaceFilterName
  const typeFilter = pickerFilters.typeFilter
  const projectTypeFilter = pickerFilters.projectTypeFilter

  // Debounced board name for API search
  const debouncedBoardName = useDebouncedValue(boardNameInput, 400)

  // Search boards from API when user types a name or selects a space
  const isSearching = debouncedBoardName.length >= 2 || !!spaceFilter
  const { data: searchResults, isLoading: searchLoading } = useBoardSearch(debouncedBoardName, spaceFilter ?? '')

  // Board name search dropdown state
  const [boardSearchOpen, setBoardSearchOpen] = useState(false)
  const boardSearchRef = useRef<HTMLDivElement>(null)
  const boardInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (boardSearchRef.current && !boardSearchRef.current.contains(e.target as Node)) {
        setBoardSearchOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // When searching, use API results; otherwise use the initial boards prop
  const sourceBoards = isSearching ? (searchResults ?? []) : boards

  const starredSet = useMemo(() => new Set(starredIds), [starredIds])
  const recentIdMap = useMemo(() => new Map(recentBoards.map((r) => [r.id, r.lastVisited])), [recentBoards])

  // Extract filter options from current source boards
  const boardTypes = useMemo(() => {
    const types = new Set(sourceBoards.map((b) => b.type))
    return Array.from(types).sort()
  }, [sourceBoards])

  const projectTypes = useMemo(() => {
    const types = new Set<string>()
    for (const b of sourceBoards) {
      if (b.location?.projectTypeKey) types.add(b.location.projectTypeKey)
    }
    return Array.from(types).sort()
  }, [sourceBoards])

  // Apply client-side filters (type, project type) on top of API results
  const filtered = useMemo(() => {
    let result = sourceBoards
    if (typeFilter) {
      result = result.filter((b) => b.type === typeFilter)
    }
    if (projectTypeFilter) {
      result = result.filter((b) => b.location?.projectTypeKey === projectTypeFilter)
    }
    return result
  }, [sourceBoards, typeFilter, projectTypeFilter])

  const hasActiveFilters = boardNameInput || spaceFilter || typeFilter || projectTypeFilter

  // Starred boards rendered directly from persisted store data
  const starred: JiraBoard[] = useMemo(
    () =>
      starredBoardData.map((sb) => ({
        id: sb.id,
        name: sb.name,
        type: sb.type as JiraBoard['type'],
        self: '',
        location: sb.projectKey
          ? {
              projectId: 0,
              projectKey: sb.projectKey,
              projectName: sb.projectName ?? '',
              projectTypeKey: sb.projectTypeKey,
            }
          : undefined,
      })),
    [starredBoardData],
  )
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
    setBoardNameInput('')
    clearPickerFilters()
    setBoardSearchOpen(false)
  }

  const handleToggleStar = useCallback(
    (board: JiraBoard) => {
      const data: StarredBoard = {
        id: board.id,
        name: board.name,
        type: board.type,
        projectKey: board.location?.projectKey,
        projectName: board.location?.projectName,
        projectTypeKey: board.location?.projectTypeKey,
      }
      toggleStar(board.id, data)
    },
    [toggleStar],
  )

  // Show dropdown when user types in board name filter and results come back
  const showBoardDropdown = boardSearchOpen && debouncedBoardName.length >= 2

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Select a Board</h1>
          <p className="text-sm text-muted-foreground">Choose a board to view. Star boards to keep them at the top.</p>
        </div>
        <StarredQuickAccess />
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <Filter className="h-4 w-4 text-muted-foreground" />

        {/* Board name search (API-backed with dropdown) */}
        <div ref={boardSearchRef} className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={boardInputRef}
            placeholder="Filter boards..."
            value={boardNameInput}
            onChange={(e) => {
              setBoardNameInput(e.target.value)
              setBoardSearchOpen(true)
            }}
            onFocus={() => {
              if (boardNameInput.length >= 2) setBoardSearchOpen(true)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setBoardSearchOpen(false)
                boardInputRef.current?.blur()
              }
            }}
            className="h-8 w-48 pl-8 text-xs"
            aria-label="Filter boards by name"
          />
          {showBoardDropdown && (
            <div className="absolute left-0 top-full z-50 mt-1 w-72 rounded-md border border-border bg-card shadow-lg">
              {searchLoading && (
                <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Searching...
                </div>
              )}
              {!searchLoading && searchResults && searchResults.length > 0 && (
                <div className="max-h-48 overflow-y-auto">
                  {searchResults.map((board) => (
                    <Link
                      key={board.id}
                      to="/board/$boardId"
                      params={{ boardId: String(board.id) }}
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors hover:bg-accent"
                      onClick={() => setBoardSearchOpen(false)}
                    >
                      <span className="flex-1 truncate font-medium">{board.name}</span>
                      {board.location?.projectKey && (
                        <span className="text-[10px] text-muted-foreground">{board.location.projectKey}</span>
                      )}
                      <Badge variant="outline" className="text-[9px] capitalize">
                        {board.type}
                      </Badge>
                    </Link>
                  ))}
                </div>
              )}
              {!searchLoading && searchResults && searchResults.length === 0 && (
                <div className="px-3 py-2 text-xs text-muted-foreground">No boards found</div>
              )}
            </div>
          )}
        </div>

        {/* Space filter (API-backed project search) */}
        <SpaceFilter
          value={spaceFilter}
          selectedName={spaceFilterName}
          onSelect={(key, name) => {
            setPickerFilters({ spaceFilter: key, spaceFilterName: name })
          }}
        />

        {boardTypes.length > 1 && (
          <FilterDropdown
            label="Board Type"
            value={typeFilter}
            options={boardTypes.map((t) => ({ id: t, label: t }))}
            onSelect={(v) => setPickerFilters({ typeFilter: v })}
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
            onSelect={(v) => setPickerFilters({ projectTypeFilter: v })}
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
          {filtered.length}
          {isSearching ? '' : ` of ${boards.length}`} boards
        </span>
      </div>

      {/* Loading state for API search */}
      {isSearching && searchLoading && (
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading boards...
        </div>
      )}

      {/* Board sections */}
      {!searchLoading && filtered.length === 0 && hasActiveFilters && (
        <div className="py-12 text-center text-sm text-muted-foreground">No boards match your filters</div>
      )}

      {starred.length > 0 && (
        <BoardSection title="Starred" boards={starred} starredSet={starredSet} onToggleStar={handleToggleStar} />
      )}

      {recentOnly.length > 0 && !showAll && !hasActiveFilters && (
        <BoardSection title="Recent" boards={recentOnly} starredSet={starredSet} onToggleStar={handleToggleStar} />
      )}

      {limitedRemaining.length > 0 && (
        <BoardSection
          title={starred.length > 0 || (recentOnly.length > 0 && !hasActiveFilters) ? 'Other Boards' : 'Boards'}
          boards={limitedRemaining}
          starredSet={starredSet}
          onToggleStar={handleToggleStar}
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
// Filter dropdown (static options)
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
// Space filter (debounced API project search)
// ---------------------------------------------------------------------------

function SpaceFilter({
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
  onToggleStar: (board: JiraBoard) => void
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
  onToggleStar: (board: JiraBoard) => void
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
          onToggleStar(board)
        }}
        title={isStarred ? 'Unstar board' : 'Star board'}
      >
        <Star className={`h-3.5 w-3.5 ${isStarred ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`} />
      </button>
    </div>
  )
}
