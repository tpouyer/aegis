import { Link } from '@tanstack/react-router'
import { Kanban, LayoutDashboard, ListChecks } from 'lucide-react'
import { useMemo } from 'react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import type { JiraBoard } from '@/lib/jira/types'

interface BoardPickerProps {
  boards: JiraBoard[]
}

const BOARD_TYPE_ICONS = {
  kanban: Kanban,
  scrum: ListChecks,
  simple: LayoutDashboard,
} as const

export function BoardPicker({ boards }: BoardPickerProps) {
  const grouped = useMemo(() => {
    const groups = new Map<string, JiraBoard[]>()
    for (const board of boards) {
      const project = board.location?.projectName ?? 'Other'
      const existing = groups.get(project) ?? []
      existing.push(board)
      groups.set(project, existing)
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [boards])

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Select a Board</h1>
        <p className="text-sm text-muted-foreground">
          Choose a board to view. Your selection will be remembered for next time.
        </p>
      </div>

      {grouped.map(([project, projectBoards]) => (
        <div key={project}>
          <h2 className="mb-2 text-sm font-medium text-muted-foreground">{project}</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {projectBoards.map((board) => {
              const Icon = BOARD_TYPE_ICONS[board.type] ?? LayoutDashboard
              return (
                <Link key={board.id} to="/board/$boardId" params={{ boardId: String(board.id) }} className="block">
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
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
