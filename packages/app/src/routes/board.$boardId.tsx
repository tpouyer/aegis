import { createFileRoute } from '@tanstack/react-router'
import { BoardView } from '@/components/board/BoardView'

export const Route = createFileRoute('/board/$boardId')({
  component: BoardPage,
})

function BoardPage() {
  const { boardId } = Route.useParams()
  const numericBoardId = Number(boardId)

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
