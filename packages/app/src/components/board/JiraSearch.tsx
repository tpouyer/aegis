import { useNavigate } from '@tanstack/react-router'
import { Loader2, Search, Sparkles, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getJiraClient } from '@/lib/jira/client'
import { useBoards } from '@/lib/jira/queries'
import type { JiraIssue } from '@/lib/jira/types'
import { providerRegistry } from '@/lib/llm/provider-registry'

interface JiraSearchProps {
  boardId: number
}

const JQL_SYSTEM_PROMPT = `You are a Jira JQL query generator. The user will describe what they want to find in natural language. Convert their request into a valid Jira Query Language (JQL) query.

Rules:
- Return ONLY the JQL query string, nothing else — no explanation, no markdown, no code fences
- Use standard JQL fields: project, issuetype, status, priority, assignee, reporter, summary, description, labels, component, sprint, created, updated, resolved, fixVersion
- For text matching use ~ (contains) operator, e.g. summary ~ "login bug"
- For the current user use currentUser()
- For dates use relative functions: startOfDay(), endOfDay(), startOfWeek(), "-7d", "-30d"
- Common status categories: "To Do", "In Progress", "In Review", "Done"
- Common priorities: Highest, High, Medium, Low, Lowest
- Common issue types: Bug, Story, Task, Epic, Sub-task
- Order results by: ORDER BY updated DESC (default), or ORDER BY priority DESC, created DESC
- If the user mentions "my" issues, use assignee = currentUser()
- If the user mentions "recent", use updated >= -7d`

function buildSystemPrompt(projectKey?: string): string {
  if (projectKey) {
    return `${JQL_SYSTEM_PROMPT}\n- The current project key is "${projectKey}". If the query is ambiguous about which project, scope to this project.`
  }
  return JQL_SYSTEM_PROMPT
}

async function queryLLMForJQL(query: string, projectKey?: string): Promise<string> {
  const provider = providerRegistry.getDefaultProvider()
  if (!provider) {
    throw new Error('No AI provider configured')
  }

  const model = provider.models[0]
  if (!model) {
    throw new Error('No models available for the configured provider')
  }

  let jql = ''
  for await (const chunk of provider.chat({
    model: model.id,
    messages: [{ id: 'search-q', role: 'user', content: query, timestamp: Date.now() }],
    systemPrompt: buildSystemPrompt(projectKey),
    maxTokens: 200,
    temperature: 0,
    stream: true,
  })) {
    if (chunk.type === 'text' && chunk.content) {
      jql += chunk.content
    }
    if (chunk.type === 'error') {
      throw new Error(chunk.error || 'LLM error')
    }
  }

  return jql
    .trim()
    .replace(/^```[a-z]*\n?/i, '')
    .replace(/\n?```$/, '')
    .trim()
}

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  indeterminate: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  done: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
}

export function JiraSearch({ boardId }: JiraSearchProps) {
  const navigate = useNavigate()
  const { data: boards } = useBoards()
  const projectKey = useMemo(() => boards?.find((b) => b.id === boardId)?.location?.projectKey, [boards, boardId])
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<JiraIssue[] | null>(null)
  const [generatedJql, setGeneratedJql] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleSearch = useCallback(async () => {
    const trimmed = query.trim()
    if (!trimmed) return

    setLoading(true)
    setError(null)
    setResults(null)
    setGeneratedJql(null)
    setOpen(true)

    try {
      const jql = await queryLLMForJQL(trimmed, projectKey)
      setGeneratedJql(jql)

      const client = getJiraClient()
      const response = await client.searchIssues(jql, undefined, 10)
      setResults(response.issues)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed')
    } finally {
      setLoading(false)
    }
  }, [query, projectKey])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        handleSearch()
      }
      if (e.key === 'Escape') {
        setOpen(false)
        inputRef.current?.blur()
      }
    },
    [handleSearch],
  )

  const handleClear = useCallback(() => {
    setQuery('')
    setResults(null)
    setGeneratedJql(null)
    setError(null)
    setOpen(false)
  }, [])

  const handleResultClick = useCallback(
    (issueKey: string) => {
      setOpen(false)
      navigate({ to: '/issue/$issueKey/chat', params: { issueKey } })
    },
    [navigate],
  )

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const hasProvider = !!providerRegistry.getDefaultProvider()

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Sparkles className="absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-primary/60" />
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (results || error) setOpen(true)
          }}
          placeholder={hasProvider ? 'AI search...' : 'Configure AI to search'}
          disabled={!hasProvider}
          aria-label="AI-powered Jira search"
          className="h-7 w-40 pl-7 pr-7 text-xs md:w-52"
        />
        {query && (
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-0.5 top-1/2 h-5 w-5 -translate-y-1/2 p-0"
            onClick={handleClear}
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>

      {/* Results dropdown */}
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-80 rounded-md border border-border bg-card shadow-lg md:w-96">
          {loading && (
            <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Searching with AI...</span>
            </div>
          )}

          {error && <div className="p-4 text-sm text-destructive">{error}</div>}

          {results && results.length === 0 && (
            <div className="p-4 text-center text-sm text-muted-foreground">No issues found</div>
          )}

          {results && results.length > 0 && (
            <div className="max-h-80 overflow-y-auto">
              {generatedJql && (
                <div className="border-b border-border px-3 py-1.5">
                  <span className="font-mono text-[10px] text-muted-foreground">{generatedJql}</span>
                </div>
              )}
              {results.map((issue) => {
                const statusColor = STATUS_COLORS[issue.fields.status.statusCategory.key] ?? ''
                return (
                  <button
                    type="button"
                    key={issue.key}
                    className="flex w-full items-start gap-3 px-3 py-2 text-left transition-colors hover:bg-accent"
                    onClick={() => handleResultClick(issue.key)}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="shrink-0 text-xs font-medium text-primary">{issue.key}</span>
                        <span className="truncate text-xs text-foreground">{issue.fields.summary}</span>
                      </div>
                      <div className="mt-0.5 flex items-center gap-1.5">
                        <Badge variant="outline" className={`text-[10px] ${statusColor}`}>
                          {issue.fields.status.name}
                        </Badge>
                        {issue.fields.assignee && (
                          <span className="text-[10px] text-muted-foreground">{issue.fields.assignee.displayName}</span>
                        )}
                      </div>
                    </div>
                    <Search className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
