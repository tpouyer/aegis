import { githubClient } from '@/lib/github/client'
import type { TreeEntry } from '@/lib/github/types'
import { recordWorkspaceRepoAddStart, recordWorkspaceRepoRemoved } from '@/lib/telemetry/instruments/workspace'
import type { VirtualFileSystem } from '@/lib/vfs/virtual-fs'

const DEBUG = import.meta.env.DEV

function log(msg: string, ...args: unknown[]) {
  if (DEBUG) console.debug(`[workspace] ${msg}`, ...args)
}

export class WorkspaceManager {
  private vfs: VirtualFileSystem
  private issueKey: string
  private repoKeys: string[] = []

  constructor(vfs: VirtualFileSystem, issueKey: string) {
    this.vfs = vfs
    this.issueKey = issueKey
  }

  async addRepo(owner: string, repo: string): Promise<string> {
    const repoKey = `${owner}/${repo}`
    if (this.repoKeys.includes(repoKey)) return repoKey

    const branchName = `feature/${this.issueKey.toLowerCase()}-impl`

    log('adding repo %s with branch %s', repoKey, branchName)
    const metric = recordWorkspaceRepoAddStart(owner, repo)
    try {
      await this.vfs.ensureBranch(owner, repo, branchName)
      await this.vfs.initRepo(owner, repo, branchName)
      metric.success()
    } catch (err) {
      metric.error(err instanceof Error ? err.message : String(err))
      throw err
    }

    this.repoKeys.push(repoKey)
    log('repo %s added to workspace (%d total)', repoKey, this.repoKeys.length)
    return repoKey
  }

  removeRepo(repoKey: string): void {
    this.repoKeys = this.repoKeys.filter((k) => k !== repoKey)
    recordWorkspaceRepoRemoved()
  }

  getRepoKeys(): string[] {
    return [...this.repoKeys]
  }

  getTree(repoKey: string): TreeEntry[] {
    return this.vfs.getTree(repoKey)
  }

  getAllTrees(): Map<string, TreeEntry[]> {
    const trees = new Map<string, TreeEntry[]>()
    for (const key of this.repoKeys) {
      trees.set(key, this.vfs.getTree(key))
    }
    return trees
  }

  getWorkspaceFiles(): Map<string, string> {
    const files = new Map<string, string>()
    for (const repoKey of this.repoKeys) {
      const tree = this.vfs.getTree(repoKey)
      for (const entry of tree) {
        if (entry.type === 'blob') {
          files.set(`${repoKey}/${entry.path}`, '')
        }
      }
    }
    return files
  }

  getVfs(): VirtualFileSystem {
    return this.vfs
  }

  getIssueKey(): string {
    return this.issueKey
  }

  async getDefaultBranch(repoKey: string): Promise<string> {
    const [owner, repo] = repoKey.split('/')
    try {
      const info = await githubClient.getRepo(owner, repo)
      return info.defaultBranch
    } catch {
      return 'main'
    }
  }
}
