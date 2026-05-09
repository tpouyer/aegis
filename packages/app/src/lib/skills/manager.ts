import {
  recordMarketplaceRefreshStart,
  recordPluginLoadStart,
  recordSkillFileRead,
} from '@/lib/telemetry/instruments/skills'
import { useSkillsConfigStore } from '@/stores/skills-config'
import type { ExecutionResult } from './executor'
import { skillExecutor } from './executor'
import * as fetcher from './fetcher'
import { skillFileStore } from './file-store'
import { parseSkillMd } from './parser'
import { encodeSkillIndex } from './toon'
import type { MarketplaceCatalog, SkillFileInfo, SkillMetadata } from './types'

const DEBUG = import.meta.env.DEV

function log(msg: string, ...args: unknown[]) {
  if (DEBUG) console.debug(`[skill-manager] ${msg}`, ...args)
}

class SkillManager {
  async loadAll(): Promise<void> {
    const { plugins } = useSkillsConfigStore.getState()
    const enabled = plugins.filter((p) => p.enabled)
    log('loading metadata for %d enabled plugins', enabled.length)
    await Promise.allSettled(enabled.map((p) => this.loadPlugin(p.id)))
  }

  async loadPlugin(pluginId: string): Promise<void> {
    const { plugins } = useSkillsConfigStore.getState()
    const plugin = plugins.find((p) => p.id === pluginId)
    if (!plugin) {
      log('plugin not found: %s', pluginId)
      return
    }

    const loadMetric = recordPluginLoadStart(pluginId)
    const result = await fetcher.fetchStandalonePlugin(plugin.source)
    if (!result) {
      loadMetric.error('fetch_failed')
      log('failed to load plugin: %s', pluginId)
      return
    }

    for (const skill of result.skills) {
      skillFileStore.setMetadata(skill.id, skill)
    }
    loadMetric.success()
    log('loaded %d skills from plugin %s', result.skills.length, pluginId)
  }

  unloadPlugin(pluginId: string): void {
    const allMeta = skillFileStore.getAllMetadata()
    for (const meta of allMeta) {
      if (meta.pluginName === pluginId || meta.id.startsWith(`${pluginId}:`)) {
        skillFileStore.clear(meta.id)
      }
    }
  }

  getSkillIndex(): string {
    const skills = skillFileStore.getAllMetadata()
    return encodeSkillIndex(skills)
  }

  getLoadedSkills(): SkillMetadata[] {
    return skillFileStore.getAllMetadata()
  }

  async readSkillFile(skillId: string, path: string): Promise<string> {
    const cached = skillFileStore.getFile(skillId, path)
    if (cached) {
      recordSkillFileRead(skillId, true)
      return cached
    }
    recordSkillFileRead(skillId, false)

    const meta = skillFileStore.getMetadata(skillId)
    if (!meta) throw new Error(`Unknown skill: ${skillId}`)

    const { plugins } = useSkillsConfigStore.getState()
    const plugin = plugins.find((p) => meta.id.startsWith(`${p.name}:`))
    if (!plugin) throw new Error(`Plugin not found for skill: ${skillId}`)

    const skillDirName = skillId.split(':')[1]
    const skillPath = `skills/${skillDirName}`

    const content = await fetcher.fetchSkillFile(plugin.source, skillPath, path)
    if (content === null) throw new Error(`File not found: ${skillId}/${path}`)

    skillFileStore.setFile(skillId, path, content)

    if (path === 'SKILL.md') {
      const parsed = parseSkillMd(content)
      if (parsed) {
        skillFileStore.setFile(skillId, '__body__', parsed.body)
      }
    }

    return content
  }

  async listSkillFiles(skillId: string): Promise<SkillFileInfo[]> {
    const cached = skillFileStore.getFilePaths(skillId)
    if (cached.length > 0) return cached.filter((f) => !f.path.startsWith('__'))

    const meta = skillFileStore.getMetadata(skillId)
    if (!meta) return []

    await this.readSkillFile(skillId, 'SKILL.md')
    return skillFileStore.getFilePaths(skillId).filter((f) => !f.path.startsWith('__'))
  }

  async executeSkillScript(
    skillId: string,
    scriptPath: string,
    args?: string[],
    workspaceFiles?: Map<string, string>,
  ): Promise<ExecutionResult> {
    const script = await this.readSkillFile(skillId, scriptPath)

    const skillFiles = new Map<string, string>()
    const paths = skillFileStore.getFilePaths(skillId)
    for (const fileInfo of paths) {
      if (fileInfo.path.startsWith('__')) continue
      const content = skillFileStore.getFile(skillId, fileInfo.path)
      if (content) skillFiles.set(fileInfo.path, content)
    }

    if (scriptPath.endsWith('.py')) {
      const fullScript = args?.length
        ? `import sys\nsys.argv = ['${scriptPath}', ${args.map((a) => `'${a}'`).join(', ')}]\n${script}`
        : script
      return skillExecutor.executePython(fullScript, workspaceFiles, skillFiles)
    }

    return skillExecutor.executeBash(script, workspaceFiles)
  }

  async refreshMarketplace(marketplaceId: string): Promise<MarketplaceCatalog | null> {
    const { marketplaces } = useSkillsConfigStore.getState()
    const marketplace = marketplaces.find((m) => m.id === marketplaceId)
    if (!marketplace) return null

    const refreshMetric = recordMarketplaceRefreshStart(marketplaceId)
    const catalog = await fetcher.fetchMarketplaceCatalog(marketplace.source)
    refreshMetric.end()
    return catalog
  }
}

export const skillManager = new SkillManager()
