import { ChevronDown, ChevronRight, Folder, FolderOpen, Plus } from 'lucide-react'
import { useCallback, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { TreeEntry } from '@/lib/github/types'
import { useIDEStore } from '@/stores/ide'
import { FileExplorer } from './FileExplorer'

interface WorkspaceExplorerProps {
  issueKey: string
  repoKeys: string[]
  repoTrees: Map<string, TreeEntry[]>
  onAddRepo: (owner: string, repo: string) => Promise<void>
}

export function WorkspaceExplorer({ issueKey, repoKeys, repoTrees, onAddRepo }: WorkspaceExplorerProps) {
  const { explorerExpandedPaths, toggleExplorerPath } = useIDEStore()
  const [adding, setAdding] = useState(false)
  const [repoInput, setRepoInput] = useState('')
  const [addingInProgress, setAddingInProgress] = useState(false)

  const handleAdd = useCallback(async () => {
    const trimmed = repoInput.trim()
    const match = trimmed.match(/(?:github\.com\/)?([^/]+)\/([^/]+?)(?:\.git)?$/)
    if (!match) return

    setAddingInProgress(true)
    try {
      await onAddRepo(match[1], match[2])
      setRepoInput('')
      setAdding(false)
    } finally {
      setAddingInProgress(false)
    }
  }, [repoInput, onAddRepo])

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <Folder className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Workspace</span>
        <span className="text-xs text-muted-foreground">{issueKey}</span>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-1" role="tree" aria-label="Workspace explorer">
          {repoKeys.length === 0 && !adding && (
            <p className="px-3 py-4 text-center text-xs text-muted-foreground">
              No repositories in workspace yet. The AI will recommend repos based on the issue, or you can add one
              manually.
            </p>
          )}

          {repoKeys.map((repoKey) => {
            const sectionPath = `__workspace__:${repoKey}`
            const isExpanded = !explorerExpandedPaths.has(sectionPath)
            const tree = repoTrees.get(repoKey) ?? []

            return (
              <div key={repoKey} className="mb-1">
                <button
                  type="button"
                  className="flex w-full items-center gap-1 rounded-sm px-1 py-1 text-left hover:bg-accent"
                  onClick={() => toggleExplorerPath(sectionPath)}
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                  <FolderOpen className="h-4 w-4 shrink-0 text-blue-400" />
                  <span className="text-sm font-medium text-foreground">{repoKey}</span>
                </button>
                {isExpanded && <FileExplorer repoKey={repoKey} tree={tree} />}
              </div>
            )
          })}

          {adding && (
            <div className="mx-2 my-2 space-y-2">
              <Input
                placeholder="owner/repo"
                value={repoInput}
                onChange={(e) => setRepoInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAdd()
                  if (e.key === 'Escape') setAdding(false)
                }}
                className="h-7 text-xs"
                aria-label="Repository to add"
                autoFocus
                disabled={addingInProgress}
              />
              <div className="flex gap-1">
                <Button
                  size="sm"
                  className="h-6 text-xs"
                  onClick={handleAdd}
                  disabled={!repoInput.trim() || addingInProgress}
                >
                  Add
                </Button>
                <Button size="sm" variant="outline" className="h-6 text-xs" onClick={() => setAdding(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {!adding && (
            <Button
              variant="ghost"
              size="sm"
              className="mx-1 mt-1 h-7 w-full justify-start gap-1 text-xs text-muted-foreground"
              onClick={() => setAdding(true)}
            >
              <Plus className="h-3.5 w-3.5" />
              Add Repository
            </Button>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
