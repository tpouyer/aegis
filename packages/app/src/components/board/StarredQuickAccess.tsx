import { useNavigate } from '@tanstack/react-router'
import { ChevronDown, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useBoardPrefsStore } from '@/stores/board-prefs'

export function StarredQuickAccess({ currentBoardId }: { currentBoardId?: number }) {
  const navigate = useNavigate()
  const starredBoards = useBoardPrefsStore((s) => s.starredBoards)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 gap-0.5 px-1.5" title="Starred boards">
          <Star className={`h-4 w-4 ${starredBoards.length > 0 ? 'fill-yellow-400 text-yellow-400' : ''}`} />
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuLabel className="text-xs">Starred Boards</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {starredBoards.length === 0 ? (
          <div className="px-3 py-2 text-xs text-muted-foreground">No starred boards yet</div>
        ) : (
          starredBoards.map((board) => (
            <DropdownMenuItem
              key={board.id}
              className={board.id === currentBoardId ? 'bg-accent' : ''}
              onClick={() => navigate({ to: '/board/$boardId', params: { boardId: String(board.id) } })}
            >
              <span className="flex-1 truncate">{board.name}</span>
              {board.projectKey && <span className="ml-2 text-[10px] text-muted-foreground">{board.projectKey}</span>}
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
