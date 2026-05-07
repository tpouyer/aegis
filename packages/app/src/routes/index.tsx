import { createFileRoute } from '@tanstack/react-router'
import { Shield } from 'lucide-react'

export const Route = createFileRoute('/')({
  component: HomePage,
})

function HomePage() {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="w-full max-w-lg rounded-lg border border-border bg-card p-8 text-center shadow-sm">
        <Shield className="mx-auto h-16 w-16 text-primary" />
        <h1 className="mt-4 text-2xl font-bold text-card-foreground">Welcome to Aegis</h1>
        <p className="mt-2 text-muted-foreground">
          Zero-infrastructure development platform. Unified kanban board, AI chat, and web IDE
          — all in your browser.
        </p>
        <div className="mt-6 flex flex-col gap-2 text-sm text-muted-foreground">
          <p>Select a page from the sidebar to get started.</p>
        </div>
      </div>
    </div>
  )
}
