import { GitBranch } from 'lucide-react'
import { useCallback, useState } from 'react'
import { Button } from '@/components/ui/button'

interface RepoProposal {
  owner: string
  repo: string
  reason?: string
}

interface WorkspaceProposalProps {
  repos: RepoProposal[]
  onAccept: (repos: RepoProposal[]) => void
  onSkip: () => void
}

export function WorkspaceProposal({ repos, onAccept, onSkip }: WorkspaceProposalProps) {
  const [selected, setSelected] = useState<Set<number>>(() => new Set(repos.map((_, i) => i)))
  const [applied, setApplied] = useState(false)

  const toggleRepo = useCallback((index: number) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }, [])

  const handleAccept = useCallback(() => {
    const accepted = repos.filter((_, i) => selected.has(i))
    onAccept(accepted)
    setApplied(true)
  }, [repos, selected, onAccept])

  if (applied) {
    const count = selected.size
    return (
      <div className="my-2 rounded-lg border border-green-500/30 bg-green-500/5 px-4 py-3 text-sm text-green-600 dark:text-green-400">
        Added {count} repositor{count !== 1 ? 'ies' : 'y'} to workspace
      </div>
    )
  }

  return (
    <div className="my-2 rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
        <GitBranch className="h-4 w-4" />
        Add repositories to workspace?
      </div>
      <div className="mb-3 space-y-1">
        {repos.map((repo, i) => (
          <label
            key={`${repo.owner}/${repo.repo}`}
            className="flex items-start gap-2 rounded px-2 py-1 hover:bg-accent"
          >
            <input
              type="checkbox"
              checked={selected.has(i)}
              onChange={() => toggleRepo(i)}
              className="mt-0.5 rounded border-border"
            />
            <div>
              <span className="text-sm font-medium text-foreground">
                {repo.owner}/{repo.repo}
              </span>
              {repo.reason && <p className="text-xs text-muted-foreground">{repo.reason}</p>}
            </div>
          </label>
        ))}
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={handleAccept} disabled={selected.size === 0}>
          Add Selected
        </Button>
        <Button size="sm" variant="outline" onClick={onSkip}>
          Skip
        </Button>
      </div>
    </div>
  )
}
