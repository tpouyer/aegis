import type { MarketplaceCatalog, PluginManifest } from './types'

export interface ParsedSkillMd {
  name: string
  description: string
  body: string
}

export function parseSkillMd(content: string): ParsedSkillMd | null {
  const fmMatch = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/)
  if (!fmMatch) return null

  const frontMatter = fmMatch[1]
  const body = fmMatch[2].trim()

  const nameMatch = frontMatter.match(/^name:\s*(.+)$/m)
  const descMatch = frontMatter.match(/^description:\s*(.+)$/m)

  const name = nameMatch?.[1]?.trim()
  const description = descMatch?.[1]?.trim()

  if (!name || !description) return null

  return { name, description, body }
}

export function parsePluginManifest(json: string): PluginManifest | null {
  try {
    const parsed = JSON.parse(json)
    if (!parsed.name || typeof parsed.name !== 'string') return null
    return parsed as PluginManifest
  } catch {
    return null
  }
}

export function parseMarketplaceCatalog(json: string): MarketplaceCatalog | null {
  try {
    const parsed = JSON.parse(json)
    if (!parsed.name || !parsed.owner || !Array.isArray(parsed.plugins)) return null
    return parsed as MarketplaceCatalog
  } catch {
    return null
  }
}
