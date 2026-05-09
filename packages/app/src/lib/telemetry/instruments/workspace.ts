import { getWorkspaceMeter } from '../meters'

const repoAdded = getWorkspaceMeter().createCounter('workspace.repo.added', {
  description: 'Repos added to workspace',
  unit: '{repo}',
})

const repoRemoved = getWorkspaceMeter().createCounter('workspace.repo.removed', {
  description: 'Repos removed from workspace',
  unit: '{repo}',
})

const repoCount = getWorkspaceMeter().createUpDownCounter('workspace.repo.count', {
  description: 'Current repo count in active workspace',
  unit: '{repo}',
})

const initDuration = getWorkspaceMeter().createHistogram('workspace.initialization.duration', {
  description: 'Time to initialize repo in workspace',
  unit: 'ms',
})

const initErrors = getWorkspaceMeter().createCounter('workspace.initialization.error.count', {
  description: 'Repo initialization failures',
  unit: '{error}',
})

export function recordWorkspaceRepoAddStart(owner: string, repo: string) {
  const startTime = performance.now()
  return {
    success() {
      initDuration.record(performance.now() - startTime, { 'repo.owner': owner, 'repo.name': repo })
      repoAdded.add(1, { 'repo.owner': owner, 'repo.name': repo })
      repoCount.add(1)
    },
    error(errorType: string) {
      initErrors.add(1, { 'repo.owner': owner, 'repo.name': repo, 'error.type': errorType })
    },
  }
}

export function recordWorkspaceRepoRemoved() {
  repoRemoved.add(1)
  repoCount.add(-1)
}
