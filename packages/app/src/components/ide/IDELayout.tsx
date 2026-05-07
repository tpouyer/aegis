/**
 * IDELayout — three-panel layout for the browser IDE.
 *
 * Layout:
 *   - Left panel:   FileExplorer (resizable, ~250px default)
 *   - Center panel:  EditorTabs + editor area
 *   - Right panel:  AI chat sidebar (placeholder for Wave 3)
 *   - Bottom panel: SourceControl (collapsible)
 *
 * Uses CSS flexbox for the panel layout.
 */

import { useState, useEffect, useCallback } from 'react'
import { Code, MessageSquare } from 'lucide-react'
import { FileExplorer } from './FileExplorer'
import { EditorTabs } from './EditorTabs'
import { EditorPlaceholder } from './EditorPlaceholder'
import { SourceControl } from './SourceControl'
import { DiffView } from './DiffView'
import { useIDEStore } from '@/stores/ide'
import type { VirtualFileSystem } from '@/lib/vfs/virtual-fs'
import type { TreeEntry } from '@/lib/github/types'
import type { FileChange, DiffResult } from '@/lib/vfs/types'

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
  const [diffResult, setDiffResult] = useState<DiffResult | null>(null)
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
    try {
      await vfs.commit(commitRepoKey, message)
      refreshChanges()
    } catch (err) {
      console.error('Commit failed:', err)
    }
  }, [vfs, refreshChanges])

  // Handle create PR
  const handleCreatePR = useCallback(async (commitRepoKey: string) => {
    try {
      const pr = await vfs.createPR(commitRepoKey, {
        title: `${issueKey}: ${issueKey}`,
        body: `Addresses ${issueKey}`,
      })
      window.open(pr.htmlUrl, '_blank')
    } catch (err) {
      console.error('PR creation failed:', err)
    }
  }, [vfs, issueKey])

  // Handle file click from source control (show diff)
  const handleSourceControlFileClick = useCallback((clickedRepo: string, path: string) => {
    const diff = vfs.getDiff(clickedRepo, path)
    setDiffResult(diff)
    if (!showDiff) {
      toggleDiffView()
    }
  }, [vfs, showDiff, toggleDiffView])

  // Handle file click from explorer
  const handleExplorerFileClick = useCallback((_repoKey: string, _path: string) => {
    // openFile is called directly by FileExplorer via the store
    // This handler is for any side effects
    refreshChanges()
  }, [refreshChanges])

  // Suppress unused var warning
  void handleExplorerFileClick
  void openFile

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
          <span>Branch: <code className="rounded bg-muted px-1.5 py-0.5">{branch}</code></span>
          <span>Base: <code className="rounded bg-muted px-1.5 py-0.5">{baseBranch}</code></span>
        </div>
      </div>

      {/* Main panels */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left panel — File Explorer */}
        <div className="w-60 shrink-0 border-r border-border bg-muted/10">
          <FileExplorer repoKey={repoKey} tree={tree} />
        </div>

        {/* Center panel — Editor */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <EditorTabs />

          <div className="flex-1 overflow-hidden">
            {showDiff && diffResult ? (
              <DiffView diff={diffResult} />
            ) : currentTab ? (
              isLoadingFile ? (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  Loading...
                </div>
              ) : (
                <EditorPlaceholder
                  path={currentTab.path}
                  content={fileContent}
                  repoKey={currentTab.repoKey}
                />
              )
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
                <Code className="h-12 w-12" />
                <p className="text-sm">Open a file from the explorer to begin editing</p>
              </div>
            )}
          </div>
        </div>

        {/* Right panel — AI Chat placeholder */}
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

      {/* Bottom panel — Source Control */}
      <SourceControl
        changes={changes}
        onCommit={handleCommit}
        onCreatePR={handleCreatePR}
        onFileClick={handleSourceControlFileClick}
      />
    </div>
  )
}
