import { createFileRoute } from '@tanstack/react-router'
import { Code } from 'lucide-react'

export const Route = createFileRoute('/issue/$issueKey/ide')({
  component: IdePage,
})

function IdePage() {
  const { issueKey } = Route.useParams()

  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="w-full max-w-lg rounded-lg border border-border bg-card p-8 text-center shadow-sm">
        <Code className="mx-auto h-16 w-16 text-primary" />
        <h1 className="mt-4 text-2xl font-bold text-card-foreground">Web IDE</h1>
        <p className="mt-2 text-muted-foreground">
          Issue: <code className="rounded bg-muted px-2 py-0.5 text-sm">{issueKey}</code>
        </p>
        <p className="mt-4 text-sm text-muted-foreground">
          Browser-based IDE with Monaco editor, AI assistant, and Git integration.
        </p>
      </div>
    </div>
  )
}
