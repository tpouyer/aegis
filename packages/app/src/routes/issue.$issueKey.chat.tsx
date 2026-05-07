import { useState, useEffect } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { FileText, Tag, User, Calendar, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ChatView } from '@/components/chat/ChatView'
import { Loading } from '@/components/shared/Loading'
import { useShortcuts, shortcutRegistry } from '@/lib/shortcuts'
import { useIssue } from '@/lib/jira/queries'
import { authManager } from '@/lib/auth/manager'
import type { JiraIssue } from '@/lib/jira/types'

export const Route = createFileRoute('/issue/$issueKey/chat')({
  component: ChatPage,
})

// ---------------------------------------------------------------------------
// ADF text extraction (mirrors CardDetail's extractText helper)
// ---------------------------------------------------------------------------

function extractText(content: unknown): string {
  if (typeof content === 'string') return content

  if (content && typeof content === 'object' && 'type' in content) {
    const adf = content as { type: string; content?: unknown[]; text?: string }
    if (adf.text) return adf.text
    if (adf.content) {
      return adf.content.map(extractText).join('\n')
    }
  }

  return ''
}

// ---------------------------------------------------------------------------
// Context sidebar
// ---------------------------------------------------------------------------

function IssueContextPanel({ issue }: { issue: JiraIssue | null }) {
  if (!issue) {
    return (
      <div className="absolute inset-0 z-20 flex h-full w-full flex-col border-l border-border bg-card md:static md:z-auto md:w-72">
        <div className="border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold text-foreground">Issue Context</h3>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-4 text-center">
          <AlertCircle className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Connect to Jira to see issue details
          </p>
        </div>
      </div>
    )
  }

  const description = issue.fields.description
    ? extractText(issue.fields.description)
    : null

  return (
    <div className="absolute inset-0 z-20 flex h-full w-full flex-col border-l border-border bg-card md:static md:z-auto md:w-72">
      <div className="border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold text-foreground">Issue Context</h3>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {/* Status + Priority */}
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{issue.fields.status.name}</Badge>
          <Badge variant="outline">{issue.fields.priority.name}</Badge>
          <Badge variant="outline">{issue.fields.issuetype.name}</Badge>
        </div>

        {/* Assignee */}
        {issue.fields.assignee && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <User className="h-4 w-4" />
            <span>{issue.fields.assignee.displayName}</span>
          </div>
        )}

        {/* Created */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="h-4 w-4" />
          <span>Created {new Date(issue.fields.created).toLocaleDateString()}</span>
        </div>

        {/* Description */}
        <div>
          <div className="mb-1 flex items-center gap-1 text-xs font-medium uppercase text-muted-foreground">
            <FileText className="h-3 w-3" />
            Description
          </div>
          {description ? (
            <p className="text-sm text-foreground">{description}</p>
          ) : (
            <p className="text-sm italic text-muted-foreground">No description provided.</p>
          )}
        </div>

        {/* Labels */}
        {issue.fields.labels.length > 0 && (
          <div>
            <div className="mb-1 flex items-center gap-1 text-xs font-medium uppercase text-muted-foreground">
              <Tag className="h-3 w-3" />
              Labels
            </div>
            <div className="flex flex-wrap gap-1">
              {issue.fields.labels.map((label) => (
                <Badge key={label} variant="outline" className="text-xs">
                  {label}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Components */}
        {issue.fields.components.length > 0 && (
          <div>
            <div className="mb-1 text-xs font-medium uppercase text-muted-foreground">
              Components
            </div>
            <div className="flex flex-wrap gap-1">
              {issue.fields.components.map((comp) => (
                <Badge key={comp.id} variant="secondary" className="text-xs">
                  {comp.name}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

function ChatPage() {
  const { issueKey } = Route.useParams()
  const [contextOpen, setContextOpen] = useState(() => typeof window !== 'undefined' ? window.innerWidth >= 768 : true)

  useEffect(() => { document.title = `${issueKey} Chat — Aegis` }, [issueKey])

  // Activate chat-scope keyboard shortcut handling
  useShortcuts('chat')

  // Register chat-scoped shortcuts
  useEffect(() => {
    const unregisterEscape = shortcutRegistry.register({
      key: 'Escape',
      scope: 'chat',
      description: 'Stop streaming',
      action: () => {
        // Dispatch event for ChatView to handle stream cancellation
        document.dispatchEvent(new CustomEvent('aegis:stop-streaming'))
      },
    })

    return () => {
      unregisterEscape()
    }
  }, [])

  // Fetch real issue data from Jira (only if connected)
  const jiraConnected = authManager.isConnected('atlassian')
  const { data: issue, isLoading: issueLoading } = useIssue(issueKey, {
    enabled: jiraConnected,
  })

  // Show loading state while issue data is being fetched
  if (jiraConnected && issueLoading) {
    return <Loading className="h-full" message="Loading issue..." />
  }

  // Derive chat context from real issue data or fall back to issue key
  const issueSummary = issue?.fields.summary ?? issueKey
  const issueDescription = issue?.fields.description
    ? extractText(issue.fields.description)
    : undefined

  return (
    <div className="flex h-full">
      {/* Main chat area */}
      <div className="flex flex-1 flex-col">
        <ChatView
          issueKey={issueKey}
          issueSummary={issueSummary}
          issueDescription={issueDescription}
          className="h-full"
        />
      </div>

      {/* Context panel toggle */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute right-0 top-1/2 z-10 h-8 w-6 -translate-y-1/2 rounded-l-md rounded-r-none border border-r-0 border-border bg-card"
        onClick={() => setContextOpen((prev) => !prev)}
        aria-label={contextOpen ? 'Close context panel' : 'Open context panel'}
      >
        {contextOpen ? (
          <ChevronRight className="h-4 w-4" />
        ) : (
          <ChevronLeft className="h-4 w-4" />
        )}
      </Button>

      {/* Context sidebar */}
      {contextOpen && <IssueContextPanel issue={issue ?? null} />}
    </div>
  )
}
