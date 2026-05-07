import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { AlertTriangle, Github } from 'lucide-react'
import { useEffect, useState } from 'react'
import { IDELayout } from '@/components/ide/IDELayout'
import { EmptyState } from '@/components/shared/EmptyState'
import { Loading } from '@/components/shared/Loading'
import { authManager } from '@/lib/auth/manager'
import { githubClient } from '@/lib/github/client'
import type { TreeEntry } from '@/lib/github/types'
import { shortcutRegistry, useShortcuts } from '@/lib/shortcuts'
import { VirtualFileSystem } from '@/lib/vfs/virtual-fs'
import { useIDEStore } from '@/stores/ide'
import { useRecentStore } from '@/stores/recent'

export const Route = createFileRoute('/issue/$issueKey/ide')({
  component: IdePage,
})

/**
 * Generate a branch name from the issue key.
 * Pattern: feature/{issueKey}-impl (slugified).
 */
function branchName(issueKey: string): string {
  return `feature/${issueKey.toLowerCase()}-impl`
}

/**
 * Default repo config — in production this comes from the manifest's
 * component-to-repo mapping or the Jira issue's "repository" custom field.
 * For now, use a placeholder that can be overridden via search params.
 */
function getRepoConfig(issueKey: string): { owner: string; repo: string } {
  // TODO: Wire to manifest config / Jira custom field
  void issueKey
  return { owner: 'ansible', repo: 'awx' }
}

function IdePage() {
  const { issueKey } = Route.useParams()
  const setActiveRepo = useIDEStore((s) => s.setActiveRepo)

  useEffect(() => {
    document.title = `${issueKey} IDE — Aegis`
  }, [issueKey])

  // Record visit for recent issues on landing page
  const recordVisit = useRecentStore((s) => s.recordVisit)
  useEffect(() => {
    recordVisit(issueKey, 'IDE Session', 'ide')
  }, [issueKey, recordVisit])

  // Activate IDE-scope keyboard shortcut handling
  useShortcuts('ide')

  // Register IDE-scoped shortcuts
  useEffect(() => {
    const unregisterSave = shortcutRegistry.register({
      key: 'mod+s',
      scope: 'ide',
      description: 'Save file',
      action: () => {
        // No-op — prevents browser save dialog. Actual save is handled
        // by the VFS auto-save on change.
      },
    })

    const unregisterCloseTab = shortcutRegistry.register({
      key: 'mod+w',
      scope: 'ide',
      description: 'Close active tab',
      action: () => {
        const { activeTab, closeTab } = useIDEStore.getState()
        if (activeTab >= 0) {
          closeTab(activeTab)
        }
      },
    })

    const unregisterEscape = shortcutRegistry.register({
      key: 'Escape',
      scope: 'ide',
      description: 'Close diff view',
      action: () => {
        const { showDiff, toggleDiffView } = useIDEStore.getState()
        if (showDiff) {
          toggleDiffView()
        }
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
  const isGitHubConnected = authManager.isConnected('github')

  const [vfs, setVfs] = useState<VirtualFileSystem | null>(null)
  const [tree, setTree] = useState<TreeEntry[]>([])
  const [branch, setBranch] = useState('')
  const [baseBranch, setBaseBranch] = useState('')
  const [repoKey, setRepoKey] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isGitHubConnected) {
      setIsLoading(false)
      return
    }

    let cancelled = false

    async function init() {
      try {
        const { owner, repo } = getRepoConfig(issueKey)
        const key = `${owner}/${repo}`
        const brName = branchName(issueKey)

        const fs = new VirtualFileSystem(githubClient)

        // Ensure branch exists (creates from default if needed)
        await fs.ensureBranch(owner, repo, brName)

        // Initialize the repo in the VFS
        await fs.initRepo(owner, repo, brName)

        if (cancelled) return

        const repoInfo = await githubClient.getRepo(owner, repo)
        const fileTree = fs.getTree(key)

        setVfs(fs)
        setTree(fileTree)
        setBranch(brName)
        setBaseBranch(repoInfo.defaultBranch)
        setRepoKey(key)
        setActiveRepo(key)
        setIsLoading(false)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to initialize IDE')
          setIsLoading(false)
        }
      }
    }

    init()
    return () => {
      cancelled = true
    }
  }, [issueKey, setActiveRepo, isGitHubConnected])

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
    return <Loading className="h-full" message={`Initializing IDE for ${issueKey}...`} />
  }

  if (error || !vfs) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-8">
        <AlertTriangle className="h-12 w-12 text-destructive" />
        <div className="text-center">
          <h2 className="text-lg font-semibold text-foreground">IDE initialization failed</h2>
          <p className="mt-1 text-sm text-muted-foreground">{error ?? 'Unknown error'}</p>
        </div>
      </div>
    )
  }

  return (
    <IDELayout vfs={vfs} repoKey={repoKey} tree={tree} issueKey={issueKey} branch={branch} baseBranch={baseBranch} />
  )
}
