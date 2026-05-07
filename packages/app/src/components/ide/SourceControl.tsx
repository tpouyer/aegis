/**
 * SourceControl — changes panel for the IDE.
 *
 * Groups changes by repo, showing each change with a status badge
 * (A/M/D). Provides a commit message input and [Commit] button
 * per repo, plus a [Create PR] button. Change count is shown in
 * a badge.
 */

import { GitBranch, ChevronUp, ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useIDEStore } from '@/stores/ide'
import type { FileChange } from '@/lib/vfs/types'
import { cn } from '@/lib/utils'

interface SourceControlProps {
  changes: FileChange[]
  onCommit: (repoKey: string, message: string) => void
  onCreatePR: (repoKey: string) => void
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
  onCommit,
  onCreatePR,
  onFileClick,
}: SourceControlProps) {
  const { commitMessage, setCommitMessage } = useIDEStore()
  const [isExpanded, setIsExpanded] = useState(true)

  // Group changes by repo
  const changesByRepo = new Map<string, FileChange[]>()
  for (const change of changes) {
    const existing = changesByRepo.get(change.repo) ?? []
    existing.push(change)
    changesByRepo.set(change.repo, existing)
  }

  const totalChanges = changes.length

  return (
    <div className="border-t border-border bg-background">
      {/* Header — clickable to collapse */}
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
            {totalChanges === 0 ? (
              <p className="py-2 text-center text-xs text-muted-foreground">
                No changes
              </p>
            ) : (
              Array.from(changesByRepo.entries()).map(([repoKey, repoChanges]) => (
                <div key={repoKey} className="mb-3">
                  {/* Repo name (only show if multi-repo) */}
                  {changesByRepo.size > 1 && (
                    <div className="mb-1 text-xs font-medium text-muted-foreground">
                      {repoKey}
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
                    />
                    <Button
                      size="sm"
                      className="h-7 text-xs"
                      disabled={!commitMessage.trim()}
                      onClick={() => onCommit(repoKey, commitMessage)}
                    >
                      Commit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => onCreatePR(repoKey)}
                    >
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
