import { Link } from '@tanstack/react-router'
import { Home, Kanban, MessageSquare, Search, Settings } from 'lucide-react'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { useSidebarStore } from '@/stores/sidebar'

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex flex-1 flex-col gap-1 p-3" aria-label="Main navigation">
      <Link
        to="/"
        className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-accent"
        activeProps={{ className: 'bg-accent text-accent-foreground', 'aria-current': 'page' as const }}
        activeOptions={{ exact: true }}
        onClick={onNavigate}
      >
        <Home className="h-4 w-4" />
        Home
      </Link>
      <Link
        to="/board/$boardId"
        params={{ boardId: '1' }}
        className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-accent"
        activeProps={{ className: 'bg-accent text-accent-foreground', 'aria-current': 'page' as const }}
        onClick={onNavigate}
      >
        <Kanban className="h-4 w-4" />
        Board
      </Link>
      <Link
        to="/chat"
        className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-accent"
        activeProps={{ className: 'bg-accent text-accent-foreground', 'aria-current': 'page' as const }}
        onClick={onNavigate}
      >
        <MessageSquare className="h-4 w-4" />
        Chat
      </Link>
      <Link
        to="/search"
        className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-accent"
        activeProps={{ className: 'bg-accent text-accent-foreground', 'aria-current': 'page' as const }}
        onClick={onNavigate}
      >
        <Search className="h-4 w-4" />
        Search
      </Link>
      <Link
        to="/settings"
        className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-accent"
        activeProps={{ className: 'bg-accent text-accent-foreground', 'aria-current': 'page' as const }}
        onClick={onNavigate}
      >
        <Settings className="h-4 w-4" />
        Settings
      </Link>
    </nav>
  )
}

export function Sidebar() {
  const sidebarOpen = useSidebarStore((s) => s.sidebarOpen)
  const closeSidebar = useSidebarStore((s) => s.closeSidebar)

  return (
    <>
      {/* Desktop sidebar - always visible on md+ */}
      <aside className="hidden h-full w-56 flex-col border-r border-sidebar-border bg-sidebar md:flex">
        <SidebarNav />
      </aside>

      {/* Mobile sidebar - slide-over sheet */}
      <Sheet
        open={sidebarOpen}
        onOpenChange={(open) => {
          if (!open) closeSidebar()
        }}
      >
        <SheetContent side="left" className="w-56 bg-sidebar p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SidebarNav onNavigate={closeSidebar} />
        </SheetContent>
      </Sheet>
    </>
  )
}
