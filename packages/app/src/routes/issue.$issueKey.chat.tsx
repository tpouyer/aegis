import { createFileRoute } from '@tanstack/react-router'
import { ChatView } from '@/components/chat/ChatView'

export const Route = createFileRoute('/issue/$issueKey/chat')({
  component: ChatPage,
})

function ChatPage() {
  const { issueKey } = Route.useParams()

  // TODO: Load issue context from Jira client when available.
  // For now, use the issue key as a stub summary. The Jira integration
  // (packages/app/src/lib/jira/) will provide full issue data in Phase 2.
  const issueSummary = `Issue ${issueKey}`
  const issueDescription = undefined
  const acceptanceCriteria = undefined

  return (
    <ChatView
      issueKey={issueKey}
      issueSummary={issueSummary}
      issueDescription={issueDescription}
      acceptanceCriteria={acceptanceCriteria}
      className="h-full"
    />
  )
}
