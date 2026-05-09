import { describe, expect, it } from 'vitest'
import { parseMarketplaceCatalog, parsePluginManifest, parseSkillMd } from '../parser'

describe('parseSkillMd', () => {
  it('parses valid front-matter with name and description', () => {
    const result = parseSkillMd('---\nname: my-skill\ndescription: Does things\n---\n# Instructions\nDo stuff.')
    expect(result).toEqual({ name: 'my-skill', description: 'Does things', body: '# Instructions\nDo stuff.' })
  })

  it('returns null for missing front-matter delimiters', () => {
    expect(parseSkillMd('no front matter here')).toBeNull()
  })

  it('returns null for missing name field', () => {
    expect(parseSkillMd('---\ndescription: Does things\n---\nbody')).toBeNull()
  })

  it('returns null for missing description field', () => {
    expect(parseSkillMd('---\nname: my-skill\n---\nbody')).toBeNull()
  })

  it('handles empty body', () => {
    const result = parseSkillMd('---\nname: test\ndescription: Test skill\n---\n')
    expect(result?.name).toBe('test')
    expect(result?.body).toBe('')
  })

  it('handles extra YAML fields gracefully', () => {
    const result = parseSkillMd('---\nname: test\ndescription: Test\nversion: 1.0\nauthor: me\n---\nbody')
    expect(result?.name).toBe('test')
    expect(result?.description).toBe('Test')
  })
})

describe('parsePluginManifest', () => {
  it('parses valid manifest', () => {
    const result = parsePluginManifest('{"name":"my-plugin","description":"A plugin","version":"1.0.0"}')
    expect(result?.name).toBe('my-plugin')
    expect(result?.description).toBe('A plugin')
  })

  it('returns null for missing name', () => {
    expect(parsePluginManifest('{"description":"no name"}')).toBeNull()
  })

  it('returns null for invalid JSON', () => {
    expect(parsePluginManifest('not json')).toBeNull()
  })
})

describe('parseMarketplaceCatalog', () => {
  it('parses valid catalog', () => {
    const json = JSON.stringify({
      name: 'my-marketplace',
      owner: { name: 'Team' },
      plugins: [{ name: 'plugin-a', source: './plugins/a' }],
    })
    const result = parseMarketplaceCatalog(json)
    expect(result?.name).toBe('my-marketplace')
    expect(result?.plugins).toHaveLength(1)
  })

  it('returns null for missing plugins array', () => {
    expect(parseMarketplaceCatalog('{"name":"m","owner":{"name":"t"}}')).toBeNull()
  })

  it('returns null for missing owner', () => {
    expect(parseMarketplaceCatalog('{"name":"m","plugins":[]}')).toBeNull()
  })

  it('returns null for invalid JSON', () => {
    expect(parseMarketplaceCatalog('bad')).toBeNull()
  })
})
