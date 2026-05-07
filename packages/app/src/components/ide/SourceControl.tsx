/**
 * SourceControl -- changes panel for the IDE.
 *
 * Groups changes by repo, showing each change with a status badge
 * (A/M/D). Provides a commit message input and [Commit] button
 * per repo, plus a [Create PR] button. Change count is shown in
 * a badge.
 *
 * Commit and PR buttons are wired to the VFS through callback props.
 * Shows commit SHA after successful commit, PR URL after successful
 * PR creation, and toast notifications on error.
 */

import { GitBranch, ChevronUp, ChevronDown, Loader2, ExternalLink, CheckCircle2 } from 'lucide-react'
import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useIDEStore } from '@/stores/ide'
import type { FileChange } from '@/lib/vfs/types'
import { cn } from '@/lib/utils'

interface SourceControlProps {
  changes: FileChange[]
  repoKey: string
  onCommit: (repoKey: string, message: string) => Promise<string>
  onCreatePR: (repoKey: string) => Promise<string>
  onFileClick: (repoKey: string, path: string) => void
}

function statusLabel(status: FileChange['status']): string {
  switch (status) {
    case 'added': return 'A'
    case 'modified': return 'M'
    case 'deleted': return 'D'
    default: return '?'
  }
}

function statusVariant(status: FileChange['status']) {
  switch (status) {
    case 'added': return 'default' as const
    case 'modified': return 'secondary' as const
    case 'deleted': return 'destructive' as const
    default: return 'outline' as const
  }
}

export function SourceControl({
  changes,
  repoKey,
  onCommit,
  onCreatePR,
  onFileClick,
}: SourceControlProps) {
  const { commitMessage, setCommitMessage } = useIDEStore()
  const [isExpanded, setIsExpanded] = useState(true)
  const [isCommitting, setIsCommitting] = useState(false)
  const [isCreatingPR, setIsCreatingPR] = useState(false)
  const [lastCommitSha, setLastCommitSha] = useState<string | null>(null)
  const [lastPRUrl, setLastPRUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Group changes by repo
  const changesByRepo = new Map<string, FileChange[]>()
  for (const change of changes) {
    const existing = changesByRepo.get(change.repo) ?? []
    existing.push(change)
    changesByRepo.set(change.repo, existing)
  }

  const totalChanges = changes.length
  const hasChanges = totalChanges > 0
  const canCommit = hasChanges && commitMessage.trim().length > 0

  const handleCommit = useCallback(async (targetRepoKey: string) => {
    setIsCommitting(true)
    setError(null)
    setLastCommitSha(null)

    try {
      const sha = await onCommit(targetRepoKey, commitMessage)
      setLastCommitSha(sha)
      setCommitMessage('')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Commit failed'
      setError(message)
    } finally {
      setIsCommitting(false)
    }
  }, [onCommit, commitMessage, setCommitMessage])

  const handleCreatePR = useCallback(async (targetRepoKey: string) => {
    setIsCreatingPR(true)
    setError(null)
    setLastPRUrl(null)

    try {
      const url = await onCreatePR(targetRepoKey)
      setLastPRUrl(url)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'PR creation failed'
      setError(message)
    } finally {
      setIsCreatingPR(false)
    }
  }, [onCreatePR])

  const isBusy = isCommitting || isCreatingPR

  return (
    <div className="border-t border-border bg-background">
      {/* Header -- clickable to collapse */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between px-3 py-2 hover:bg-accent"
      >
        <div className="flex items-center gap-2">
          <GitBranch className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Source Control
          </span>
          {totalChanges > 0 && (
            <Badge variant="secondary" className="h-5 px-1.5 text-xs">
              {totalChanges}
            </Badge>
          )}
        </div>
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {isExpanded && (
        <ScrollArea className="max-h-48">
          <div className="px-3 pb-3">
            {/* Error banner */}
            {error && (
              <div className="mb-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                {error}
              </div>
            )}

            {/* Success banners */}
            {lastCommitSha && (
              <div className="mb-2 flex items-center gap-2 rounded-md border border-green-500/30 bg-green-500/5 px-3 py-2 text-xs text-green-600 dark:text-green-400">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                <span>
                  Committed: <code className="rounded bg-muted px-1 py-0.5">{lastCommitSha.slice(0, 7)}</code>
                </span>
              </div>
            )}

            {lastPRUrl && (
              <div className="mb-2 flex items-center gap-2 rounded-md border border-green-500/30 bg-green-500/5 px-3 py-2 text-xs text-green-600 dark:text-green-400">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                <span>PR created</span>
                <a
                  href={lastPRUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 underline hover:no-underline"
                >
                  View <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}

            {totalChanges === 0 ? (
              <p className="py-2 text-center text-xs text-muted-foreground">
                No changes
              </p>
            ) : (
              Array.from(changesByRepo.entries()).map(([changeRepoKey, repoChanges]) => (
                <div key={changeRepoKey} className="mb-3">
                  {/* Repo name (only show if multi-repo) */}
                  {changesByRepo.size > 1 && (
                    <div className="mb-1 text-xs font-medium text-muted-foreground">
                      {changeRepoKey}
                    </div>
                  )}

                  {/* Change list */}
                  <div className="mb-2 space-y-0.5">
                    {repoChanges.map((change) => (
                      <button
                        key={change.path}
                        onClick={() => onFileClick(change.repo, change.path)}
                        className={cn(
                          'flex w-full items-center gap-2 rounded-sm px-2 py-1 text-left text-xs hover:bg-accent',
                          change.status === 'deleted' && 'line-through opacity-70',
                        )}
                      >
                        <Badge
                          variant={statusVariant(change.status)}
                          className="h-4 w-4 items-center justify-center p-0 text-[10px]"
                        >
                          {statusLabel(change.status)}
                        </Badge>
                        <span className="truncate text-foreground">{change.path}</span>
                      </button>
                    ))}
                  </div>

                  {/* Commit controls */}
                  <div className="flex items-center gap-2">
                    <Input
                      value={commitMessage}
                      onChange={(e) => setCommitMessage(e.target.value)}
                      placeholder="Commit message..."
                      className="h-7 text-xs"
                      disabled={isBusy}
                    />
                    <Button
                      size="sm"
                      className="h-7 gap-1.5 text-xs"
                      disabled={!canCommit || isBusy}
                      onClick={() => handleCommit(changeRepoKey)}
                    >
                      {isCommitting && <Loader2 className="h-3 w-3 animate-spin" />}
                      Commit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 gap-1.5 text-xs"
                      disabled={isBusy}
                      onClick={() => handleCreatePR(changeRepoKey)}
                    >
                      {isCreatingPR && <Loader2 className="h-3 w-3 animate-spin" />}
                      Create PR
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      )}
    </div>
  )
}
