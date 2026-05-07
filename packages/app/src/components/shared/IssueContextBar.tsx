import { Link, useMatchRoute } from '@tanstack/react-router'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface IssueContextBarProps {
  issueKey: string
}

export function IssueContextBar({ issueKey }: IssueContextBarProps) {
  const matchRoute = useMatchRoute()
  const isChat = matchRoute({ to: '/issue/$issueKey/chat', params: { issueKey } })
  const isIde = matchRoute({ to: '/issue/$issueKey/ide', params: { issueKey } })

  return (
    <div className="flex items-center justify-between border-b border-border bg-card px-4 py-1.5">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-1 text-sm">
        <Link to="/board" className="text-muted-foreground hover:text-foreground">
          Board
        </Link>
        <ChevronRight className="h-3 w-3 text-muted-foreground" />
        <span className="font-medium text-foreground">{issueKey}</span>
      </div>

      {/* View switcher */}
      <div className="flex items-center gap-1 rounded-md border border-border p-0.5">
        <Link
          to="/issue/$issueKey/chat"
          params={{ issueKey }}
          className={cn(
            'rounded px-3 py-1 text-xs font-medium transition-colors',
            isChat ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          Chat
        </Link>
        <Link
          to="/issue/$issueKey/ide"
          params={{ issueKey }}
          className={cn(
            'rounded px-3 py-1 text-xs font-medium transition-colors',
            isIde ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          IDE
        </Link>
      </div>
    </div>
  )
}
