import { useState, useEffect } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Search as SearchIcon } from 'lucide-react'
import { Input } from '@/components/ui/input'

export const Route = createFileRoute('/search')({
  component: SearchPage,
})

function SearchPage() {
  useEffect(() => { document.title = 'Search — Aegis' }, [])
  const [query, setQuery] = useState('')

  // Since Jira client may not be initialized, show a placeholder search UI
  // The search results would come from useJiraSearch() when Jira is connected

  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="mb-6 flex items-center gap-3">
        <SearchIcon className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">Search Issues</h1>
          <p className="text-sm text-muted-foreground">Find Jira issues by keyword, issue key, or description</p>
        </div>
      </div>

      <div className="relative mb-6">
        <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search issues..."
          aria-label="Search issues"
          className="pl-10 text-base"
          autoFocus
        />
      </div>

      {/* Results area - placeholder for now since JiraClient search needs to be connected */}
      {query.length > 0 ? (
        <div className="text-center py-12 text-sm text-muted-foreground">
          Connect to Jira to search issues
        </div>
      ) : (
        <div className="text-center py-12 text-sm text-muted-foreground">
          Type to search across all Jira issues
        </div>
      )}
    </div>
  )
}
