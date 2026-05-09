import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { AlertTriangle, Github } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { IDELayout } from '@/components/ide/IDELayout'
import { EmptyState } from '@/components/shared/EmptyState'
import { Loading } from '@/components/shared/Loading'
import { authManager } from '@/lib/auth/manager'
import { githubClient } from '@/lib/github/client'
import type { TreeEntry } from '@/lib/github/types'
import { WorkspaceManager } from '@/lib/ide/workspace'
import { shortcutRegistry, useShortcuts } from '@/lib/shortcuts'
import { VirtualFileSystem } from '@/lib/vfs/virtual-fs'
import { useIDEStore } from '@/stores/ide'
import { useRecentStore } from '@/stores/recent'

export const Route = createFileRoute('/issue/$issueKey/ide')({
  component: IdePage,
})

function IdePage() {
  const { issueKey } = Route.useParams()
  const setActiveRepo = useIDEStore((s) => s.setActiveRepo)

  useEffect(() => {
    document.title = `${issueKey} IDE — Aegis`
  }, [issueKey])

  const recordVisit = useRecentStore((s) => s.recordVisit)
  useEffect(() => {
    recordVisit(issueKey, 'IDE Session', 'ide')
  }, [issueKey, recordVisit])

  useShortcuts('ide')

  useEffect(() => {
    const unregisterSave = shortcutRegistry.register({
      key: 'mod+s',
      scope: 'ide',
      description: 'Save file',
      action: () => {},
    })

    const unregisterCloseTab = shortcutRegistry.register({
      key: 'mod+w',
      scope: 'ide',
      description: 'Close active tab',
      action: () => {
        const { activeTab, closeTab } = useIDEStore.getState()
        if (activeTab >= 0) closeTab(activeTab)
      },
    })

    const unregisterEscape = shortcutRegistry.register({
      key: 'Escape',
      scope: 'ide',
      description: 'Close diff view',
      action: () => {
        const { showDiff, toggleDiffView } = useIDEStore.getState()
        if (showDiff) toggleDiffView()
      },
      when: () => useIDEStore.getState().showDiff,
    })

    return () => {
      unregisterSave()
      unregisterCloseTab()
      unregisterEscape()
    }
  }, [])

  const navigate = useNavigate()

  const [isGitHubConnected, setIsGitHubConnected] = useState(() => !!authManager.getState().tokens.github?.accessToken)
  useEffect(() => {
    return authManager.onAuthChange(() => {
      setIsGitHubConnected(!!authManager.getState().tokens.github?.accessToken)
    })
  }, [])

  const [workspace, setWorkspace] = useState<WorkspaceManager | null>(null)
  const [repoKeys, setRepoKeys] = useState<string[]>([])
  const [repoTrees, setRepoTrees] = useState<Map<string, TreeEntry[]>>(new Map())
  const [isLoading, setIsLoading] = useState(true)
  const [error] = useState<string | null>(null)

  const branchName = `feature/${issueKey.toLowerCase()}-impl`

  useEffect(() => {
    if (!isGitHubConnected) {
      setIsLoading(false)
      return
    }

    const vfs = new VirtualFileSystem(githubClient)
    const ws = new WorkspaceManager(vfs, issueKey)
    setWorkspace(ws)
    setIsLoading(false)
  }, [issueKey, isGitHubConnected])

  const handleAddRepo = useCallback(
    async (owner: string, repo: string) => {
      if (!workspace) return
      const repoKey = await workspace.addRepo(owner, repo)
      setActiveRepo(repoKey)
      setRepoKeys(workspace.getRepoKeys())
      setRepoTrees(workspace.getAllTrees())
    },
    [workspace, setActiveRepo],
  )

  if (!isGitHubConnected) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <EmptyState
          variant="auth-required"
          icon={Github}
          title="Connect GitHub to use the IDE"
          description="The web IDE needs access to your GitHub repositories. Connect your GitHub account in Settings."
          action={{
            label: 'Go to Settings',
            onClick: () => navigate({ to: '/settings' }),
          }}
        />
      </div>
    )
  }

  if (isLoading) {
    return <Loading className="h-full" message={`Initializing workspace for ${issueKey}...`} />
  }

  if (error || !workspace) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-8">
        <AlertTriangle className="h-12 w-12 text-destructive" />
        <div className="text-center">
          <h2 className="text-lg font-semibold text-foreground">Workspace initialization failed</h2>
          <p className="mt-1 text-sm text-muted-foreground">{error ?? 'Unknown error'}</p>
        </div>
      </div>
    )
  }

  return (
    <IDELayout
      workspace={workspace}
      issueKey={issueKey}
      branch={branchName}
      repoKeys={repoKeys}
      repoTrees={repoTrees}
      onAddRepo={handleAddRepo}
    />
  )
}
