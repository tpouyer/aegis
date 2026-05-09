import { githubClient } from '@/lib/github/client'
import { parseMarketplaceCatalog, parsePluginManifest, parseSkillMd } from './parser'
import type { MarketplaceCatalog, MarketplacePluginEntry, PluginSource, SkillMetadata } from './types'

const DEBUG = import.meta.env.DEV

function log(msg: string, ...args: unknown[]) {
  if (DEBUG) console.debug(`[skill-fetcher] ${msg}`, ...args)
}

export function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  const match = url.match(/(?:github\.com\/|^)([^/]+)\/([^/]+?)(?:\.git)?$/)
  if (!match) return null
  return { owner: match[1], repo: match[2] }
}

function resolveGitHubSource(
  source: PluginSource | string,
): { owner: string; repo: string; ref?: string; path?: string } | null {
  if (typeof source === 'string') {
    if (source.startsWith('./')) return null
    const parsed = parseGitHubUrl(source)
    return parsed ? { ...parsed } : null
  }
  if (source.source === 'github') {
    const parsed = parseGitHubUrl(source.repo)
    return parsed ? { ...parsed, ref: source.ref } : null
  }
  if (source.source === 'git-subdir') {
    const parsed = parseGitHubUrl(source.url)
    return parsed ? { ...parsed, ref: source.ref, path: source.path } : null
  }
  if (source.source === 'url') {
    const parsed = parseGitHubUrl(source.url)
    return parsed ? { ...parsed, ref: source.ref } : null
  }
  return null
}

export async function fetchMarketplaceCatalog(source: PluginSource | string): Promise<MarketplaceCatalog | null> {
  const resolved = resolveGitHubSource(source)
  if (!resolved) {
    log('cannot resolve marketplace source: %o', source)
    return null
  }

  try {
    const ref = resolved.ref ?? (await getDefaultBranch(resolved.owner, resolved.repo))
    const content = await githubClient.getFileContent(
      resolved.owner,
      resolved.repo,
      '.claude-plugin/marketplace.json',
      ref,
    )
    const json = content.encoding === 'base64' ? atob(content.content) : content.content
    const catalog = parseMarketplaceCatalog(json)
    if (catalog) log('fetched marketplace %s with %d plugins', catalog.name, catalog.plugins.length)
    return catalog
  } catch (err) {
    log('failed to fetch marketplace catalog: %s', err instanceof Error ? err.message : err)
    return null
  }
}

export async function fetchPluginSkills(
  entry: MarketplacePluginEntry,
  marketplaceSource: PluginSource | string,
  pluginRoot?: string,
): Promise<SkillMetadata[]> {
  const pluginSource = resolvePluginSource(entry, marketplaceSource, pluginRoot)
  if (!pluginSource) return []

  try {
    const ref = pluginSource.ref ?? (await getDefaultBranch(pluginSource.owner, pluginSource.repo))
    const basePath = pluginSource.path ? `${pluginSource.path}/` : ''
    const refSha = await githubClient.getRef(pluginSource.owner, pluginSource.repo, `heads/${ref}`)
    const commitData = await githubClient.getCommit(pluginSource.owner, pluginSource.repo, refSha.sha)
    const tree = await githubClient.getTree(pluginSource.owner, pluginSource.repo, commitData.tree.sha, true)

    const skillMdPaths = tree.filter(
      (e) => e.path.startsWith(`${basePath}skills/`) && e.path.endsWith('/SKILL.md') && e.type === 'blob',
    )

    const skills: SkillMetadata[] = []

    for (const skillEntry of skillMdPaths) {
      try {
        const content = await githubClient.getBlob(pluginSource.owner, pluginSource.repo, skillEntry.sha!)
        const parsed = parseSkillMd(content)
        if (parsed) {
          const skillDirName = skillEntry.path.split('/').slice(-2, -1)[0]
          skills.push({
            id: `${entry.name}:${skillDirName}`,
            name: parsed.name,
            pluginName: entry.name,
            description: parsed.description,
          })
        }
      } catch {
        log('failed to parse SKILL.md at %s', skillEntry.path)
      }
    }

    log('discovered %d skills in plugin %s', skills.length, entry.name)
    return skills
  } catch (err) {
    log('failed to fetch plugin skills for %s: %s', entry.name, err instanceof Error ? err.message : err)
    return []
  }
}

export async function fetchSkillFile(
  source: PluginSource | string,
  skillPath: string,
  subPath?: string,
): Promise<string | null> {
  const resolved = resolveGitHubSource(source)
  if (!resolved) return null

  try {
    const ref = resolved.ref ?? (await getDefaultBranch(resolved.owner, resolved.repo))
    const basePath = resolved.path ? `${resolved.path}/` : ''
    const fullPath = `${basePath}${skillPath}${subPath ? `/${subPath}` : ''}`
    const content = await githubClient.getFileContent(resolved.owner, resolved.repo, fullPath, ref)
    return content.encoding === 'base64' ? atob(content.content) : content.content
  } catch {
    return null
  }
}

export async function fetchStandalonePlugin(
  source: PluginSource | string,
): Promise<{ manifest: ReturnType<typeof parsePluginManifest>; skills: SkillMetadata[] } | null> {
  const resolved = resolveGitHubSource(source)
  if (!resolved) return null

  try {
    const ref = resolved.ref ?? (await getDefaultBranch(resolved.owner, resolved.repo))
    const basePath = resolved.path ? `${resolved.path}/` : ''

    let manifest: ReturnType<typeof parsePluginManifest> = null
    try {
      const manifestContent = await githubClient.getFileContent(
        resolved.owner,
        resolved.repo,
        `${basePath}.claude-plugin/plugin.json`,
        ref,
      )
      const json = manifestContent.encoding === 'base64' ? atob(manifestContent.content) : manifestContent.content
      manifest = parsePluginManifest(json)
    } catch {
      log('no plugin.json found, discovering skills directly')
    }

    const pluginName = manifest?.name ?? resolved.repo
    const entry: MarketplacePluginEntry = { name: pluginName, source, description: manifest?.description }
    const skills = await fetchPluginSkills(entry, source)

    return { manifest, skills }
  } catch (err) {
    log('failed to fetch standalone plugin: %s', err instanceof Error ? err.message : err)
    return null
  }
}

function resolvePluginSource(
  entry: MarketplacePluginEntry,
  marketplaceSource: PluginSource | string,
  pluginRoot?: string,
): { owner: string; repo: string; ref?: string; path?: string } | null {
  const entrySource = entry.source

  if (typeof entrySource === 'string' && entrySource.startsWith('./')) {
    const marketplaceResolved = resolveGitHubSource(marketplaceSource)
    if (!marketplaceResolved) return null
    const relativePath = pluginRoot ? `${pluginRoot}/${entrySource.substring(2)}` : entrySource.substring(2)
    return { ...marketplaceResolved, path: relativePath }
  }

  return resolveGitHubSource(entrySource)
}

async function getDefaultBranch(owner: string, repo: string): Promise<string> {
  try {
    const repoInfo = await githubClient.getRepo(owner, repo)
    return repoInfo.defaultBranch
  } catch {
    return 'main'
  }
}
