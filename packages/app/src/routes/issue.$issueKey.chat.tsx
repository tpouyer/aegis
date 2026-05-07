import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { FileText, Tag, User, Calendar, ChevronLeft, ChevronRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ChatView } from '@/components/chat/ChatView'

export const Route = createFileRoute('/issue/$issueKey/chat')({
  component: ChatPage,
})

// ---------------------------------------------------------------------------
// Mock issue data — replaced by Jira client in Phase 2
// ---------------------------------------------------------------------------

interface MockIssue {
  key: string
  summary: string
  description: string
  status: string
  priority: string
  assignee: string
  issueType: string
  created: string
  acceptanceCriteria: string
  labels: string[]
  components: string[]
}

function getMockIssue(issueKey: string): MockIssue {
  return {
    key: issueKey,
    summary: `Implement feature for ${issueKey}`,
    description:
      `This issue tracks the implementation of the feature described in ${issueKey}. ` +
      'The goal is to deliver the functionality outlined in the acceptance criteria below, ' +
      'following the team coding standards and architecture guidelines.',
    status: 'In Progress',
    priority: 'Medium',
    assignee: 'dev-user',
    issueType: 'Story',
    created: new Date().toISOString().split('T')[0],
    acceptanceCriteria:
      '- Feature works as described in the requirements\n' +
      '- Unit tests cover all new exports\n' +
      '- No regressions in existing tests\n' +
      '- Code reviewed and approved',
    labels: ['ai-chat', 'wave-3'],
    components: ['app-frontend'],
  }
}

// ---------------------------------------------------------------------------
// Context sidebar
// ---------------------------------------------------------------------------

function IssueContextPanel({ issue }: { issue: MockIssue }) {
  return (
    <div className="flex h-full w-72 flex-col border-l border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold text-foreground">Issue Context</h3>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {/* Status + Priority */}
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{issue.status}</Badge>
          <Badge variant="outline">{issue.priority}</Badge>
          <Badge variant="outline">{issue.issueType}</Badge>
        </div>

        {/* Assignee */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <User className="h-4 w-4" />
          <span>{issue.assignee}</span>
        </div>

        {/* Created */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="h-4 w-4" />
          <span>Created {issue.created}</span>
        </div>

        {/* Description */}
        <div>
          <div className="mb-1 flex items-center gap-1 text-xs font-medium uppercase text-muted-foreground">
            <FileText className="h-3 w-3" />
            Description
          </div>
          <p className="text-sm text-foreground">{issue.description}</p>
        </div>

        {/* Acceptance Criteria */}
        {issue.acceptanceCriteria && (
          <div>
            <div className="mb-1 text-xs font-medium uppercase text-muted-foreground">
              Acceptance Criteria
            </div>
            <pre className="whitespace-pre-wrap text-sm text-foreground">
              {issue.acceptanceCriteria}
            </pre>
          </div>
        )}

        {/* Labels */}
        {issue.labels.length > 0 && (
          <div>
            <div className="mb-1 flex items-center gap-1 text-xs font-medium uppercase text-muted-foreground">
              <Tag className="h-3 w-3" />
              Labels
            </div>
            <div className="flex flex-wrap gap-1">
              {issue.labels.map((label) => (
                <Badge key={label} variant="outline" className="text-xs">
                  {label}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Components */}
        {issue.components.length > 0 && (
          <div>
            <div className="mb-1 text-xs font-medium uppercase text-muted-foreground">
              Components
            </div>
            <div className="flex flex-wrap gap-1">
              {issue.components.map((comp) => (
                <Badge key={comp} variant="secondary" className="text-xs">
                  {comp}
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
  const [contextOpen, setContextOpen] = useState(true)

  // Mock issue data — will be replaced by Jira client in Phase 2
  const issue = getMockIssue(issueKey)

  return (
    <div className="flex h-full">
      {/* Main chat area */}
      <div className="flex flex-1 flex-col">
        <ChatView
          issueKey={issueKey}
          issueSummary={issue.summary}
          issueDescription={issue.description}
          acceptanceCriteria={issue.acceptanceCriteria}
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
      {contextOpen && <IssueContextPanel issue={issue} />}
    </div>
  )
}
