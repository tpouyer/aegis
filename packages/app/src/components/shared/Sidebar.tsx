import { Link } from '@tanstack/react-router'
import { Home, Kanban, Settings } from 'lucide-react'

export function Sidebar() {
  return (
    <aside className="flex h-full w-56 flex-col border-r border-sidebar-border bg-sidebar">
      <nav className="flex flex-1 flex-col gap-1 p-3">
        <Link
          to="/"
          className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-accent"
          activeProps={{ className: 'bg-accent text-accent-foreground' }}
          activeOptions={{ exact: true }}
        >
          <Home className="h-4 w-4" />
          Home
        </Link>
        <Link
          to="/board/$boardId"
          params={{ boardId: '1' }}
          className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-accent"
          activeProps={{ className: 'bg-accent text-accent-foreground' }}
        >
          <Kanban className="h-4 w-4" />
          Board
        </Link>
        <Link
          to="/settings"
          className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-accent"
          activeProps={{ className: 'bg-accent text-accent-foreground' }}
        >
          <Settings className="h-4 w-4" />
          Settings
        </Link>
      </nav>
    </aside>
  )
}
