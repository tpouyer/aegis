import { useEffect } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { ChatView } from '@/components/chat/ChatView'
import { useShortcuts } from '@/lib/shortcuts'

export const Route = createFileRoute('/chat')({
  component: GeneralChatPage,
})

function GeneralChatPage() {
  useEffect(() => { document.title = 'Chat — Aegis' }, [])
  useShortcuts('chat')

  return (
    <div className="flex h-full">
      <div className="flex flex-1 flex-col">
        <ChatView
          issueKey=""
          issueSummary=""
          className="h-full"
        />
      </div>
    </div>
  )
}
