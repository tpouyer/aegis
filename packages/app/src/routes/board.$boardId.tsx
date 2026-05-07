import { createFileRoute } from '@tanstack/react-router'
import { Kanban } from 'lucide-react'

export const Route = createFileRoute('/board/$boardId')({
  component: BoardPage,
})

function BoardPage() {
  const { boardId } = Route.useParams()

  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="w-full max-w-lg rounded-lg border border-border bg-card p-8 text-center shadow-sm">
        <Kanban className="mx-auto h-16 w-16 text-primary" />
        <h1 className="mt-4 text-2xl font-bold text-card-foreground">Kanban Board</h1>
        <p className="mt-2 text-muted-foreground">
          Board: <code className="rounded bg-muted px-2 py-0.5 text-sm">{boardId}</code>
        </p>
        <p className="mt-4 text-sm text-muted-foreground">
          Jira-backed kanban board with drag-and-drop transitions.
        </p>
      </div>
    </div>
  )
}
