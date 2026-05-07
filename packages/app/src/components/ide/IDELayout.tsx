/**
 * IDELayout — three-panel layout for the browser IDE.
 *
 * Layout:
 *   - Left panel:   FileExplorer (resizable, ~250px default)
 *   - Center panel:  EditorTabs + editor area (MonacoEditor / MonacoDiffView)
 *   - Right panel:  AI chat sidebar (placeholder for Wave 3)
 *   - Bottom panel: SourceControl (collapsible)
 *
 * Uses CSS flexbox for the panel layout. Monaco is lazy-loaded so the
 * initial bundle stays small.
 */

import { useState, useEffect, useCallback } from 'react'
import { Code, MessageSquare, GitCompareArrows, FileCode, FolderOpen, Github } from 'lucide-react'
import { FileExplorer } from './FileExplorer'
import { EditorTabs } from './EditorTabs'
import { MonacoEditor } from './MonacoEditor'
import { MonacoDiffView } from './MonacoDiffView'
import { SourceControl } from './SourceControl'
import { EmptyState } from '@/components/shared/EmptyState'
import { useIDEStore } from '@/stores/ide'
import { Button } from '@/components/ui/button'
import type { VirtualFileSystem } from '@/lib/vfs/virtual-fs'
import type { TreeEntry } from '@/lib/github/types'
import type { FileChange } from '@/lib/vfs/types'
import { cn } from '@/lib/utils'

/** Tracks which file+repo the diff view is showing. */
interface DiffTarget {
  repoKey: string
  path: string
  original: string
  modified: string
}

interface IDELayoutProps {
  vfs: VirtualFileSystem
  repoKey: string
  tree: TreeEntry[]
  issueKey: string
  branch: string
  baseBranch: string
}

export function IDELayout({
  vfs,
  repoKey,
  tree,
  issueKey,
  branch,
  baseBranch,
}: IDELayoutProps) {
  const {
    openTabs,
    activeTab,
    showDiff,
    openFile,
    toggleDiffView,
  } = useIDEStore()

  const [fileContent, setFileContent] = useState<string>('')
  const [changes, setChanges] = useState<FileChange[]>([])
  const [diffTarget, setDiffTarget] = useState<DiffTarget | null>(null)
  const [isLoadingFile, setIsLoadingFile] = useState(false)

  // Current active tab info
  const currentTab = activeTab >= 0 && activeTab < openTabs.length
    ? openTabs[activeTab]
    : null

  // Refresh the changes list
  const refreshChanges = useCallback(() => {
    setChanges(vfs.getChanges(repoKey))
  }, [vfs, repoKey])

  // Load file content when active tab changes
  useEffect(() => {
    if (!currentTab) {
      setFileContent('')
      return
    }

    let cancelled = false
    setIsLoadingFile(true)

    vfs.readFile(currentTab.repoKey, currentTab.path).then((content) => {
      if (!cancelled) {
        setFileContent(content)
        setIsLoadingFile(false)
      }
    }).catch((err) => {
      if (!cancelled) {
        setFileContent(`Error loading file: ${err.message}`)
        setIsLoadingFile(false)
      }
    })

    return () => { cancelled = true }
  }, [currentTab, vfs])

  // Handle commit
  const handleCommit = useCallback(async (commitRepoKey: string, message: string) => {
    const sha = await vfs.commit(commitRepoKey, message)
    refreshChanges()
    return sha
  }, [vfs, refreshChanges])

  // Handle create PR
  const handleCreatePR = useCallback(async (commitRepoKey: string) => {
    const pr = await vfs.createPR(commitRepoKey, {
      title: `${issueKey}: ${issueKey}`,
      body: `Addresses ${issueKey}`,
    })
    return pr.htmlUrl
  }, [vfs, issueKey])

  // Handle file click from source control (show Monaco diff)
  const handleSourceControlFileClick = useCallback((clickedRepo: string, path: string) => {
    const diff = vfs.getDiff(clickedRepo, path)
    if (diff.hunks.length === 0) return

    // Extract original and modified content from the diff's underlying change
    const change = vfs.getChanges(clickedRepo).find((c) => c.path === path)
    setDiffTarget({
      repoKey: clickedRepo,
      path,
      original: change?.originalContent ?? '',
      modified: change?.currentContent ?? '',
    })

    if (!showDiff) {
      toggleDiffView()
    }
  }, [vfs, showDiff, toggleDiffView])

  // Handle file content changes from Monaco
  const handleContentChange = useCallback(() => {
    refreshChanges()
  }, [refreshChanges])

  // Suppress unused var warnings
  void openFile
  void handleContentChange

  return (
    <div className="flex h-full flex-col">
      {/* IDE Header */}
      <div className="flex items-center justify-between border-b border-border bg-muted/30 px-4 py-2">
        <div className="flex items-center gap-3">
          <Code className="h-5 w-5 text-primary" />
          <span className="text-sm font-semibold text-foreground">
            Aegis IDE
          </span>
          <span className="text-sm text-muted-foreground">
            {issueKey}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {/* Code/Diff toggle */}
          {currentTab && (
            <div className="mr-2 flex items-center gap-1 rounded-md border border-border p-0.5">
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  'h-6 gap-1 px-2 text-xs',
                  !showDiff && 'bg-accent',
                )}
                onClick={() => { if (showDiff) toggleDiffView() }}
              >
                <FileCode className="h-3 w-3" />
                Code
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  'h-6 gap-1 px-2 text-xs',
                  showDiff && 'bg-accent',
                )}
                onClick={() => { if (!showDiff) toggleDiffView() }}
              >
                <GitCompareArrows className="h-3 w-3" />
                Diff
              </Button>
            </div>
          )}
          <span>Branch: <code className="rounded bg-muted px-1.5 py-0.5">{branch}</code></span>
          <span>Base: <code className="rounded bg-muted px-1.5 py-0.5">{baseBranch}</code></span>
        </div>
      </div>

      {/* Main panels */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left panel -- File Explorer */}
        <div className="w-60 shrink-0 border-r border-border bg-muted/10">
          <FileExplorer repoKey={repoKey} tree={tree} />
        </div>

        {/* Center panel -- Editor */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <EditorTabs />

          <div className="flex-1 overflow-hidden">
            {showDiff && diffTarget ? (
              <MonacoDiffView
                originalContent={diffTarget.original}
                modifiedContent={diffTarget.modified}
                path={diffTarget.path}
              />
            ) : currentTab ? (
              isLoadingFile ? (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  Loading...
                </div>
              ) : (
                <MonacoEditor
                  path={currentTab.path}
                  content={fileContent}
                  repoKey={currentTab.repoKey}
                  vfs={vfs}
                />
              )
            ) : tree.length === 0 ? (
              <div className="flex h-full items-center justify-center p-8">
                <EmptyState
                  variant="auth-required"
                  icon={Github}
                  title="Connect to GitHub to open a repository"
                  description="Link your GitHub account to browse repositories, edit files, and create pull requests from the IDE."
                  action={{
                    label: 'Connect to GitHub',
                    onClick: () => {
                      window.location.href = '/settings';
                    },
                  }}
                />
              </div>
            ) : (
              <div className="flex h-full items-center justify-center p-8">
                <EmptyState
                  variant="info"
                  icon={FolderOpen}
                  title="Select a file to start editing"
                  description="Browse the file tree on the left and click a file to open it in the editor."
                />
              </div>
            )}
          </div>
        </div>

        {/* Right panel -- AI Chat placeholder */}
        <div className="w-72 shrink-0 border-l border-border bg-muted/10">
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              AI Assistant
            </span>
          </div>
          <div className="flex h-full items-center justify-center p-4">
            <p className="text-center text-xs text-muted-foreground">
              AI chat will be available in Wave 3
            </p>
          </div>
        </div>
      </div>

      {/* Bottom panel -- Source Control */}
      <SourceControl
        changes={changes}
        repoKey={repoKey}
        onCommit={handleCommit}
        onCreatePR={handleCreatePR}
        onFileClick={handleSourceControlFileClick}
      />
    </div>
  )
}
