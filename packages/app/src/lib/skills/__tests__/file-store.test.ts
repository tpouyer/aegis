import { afterEach, describe, expect, it } from 'vitest'
import { skillFileStore } from '../file-store'

describe('SkillFileStore', () => {
  afterEach(() => {
    skillFileStore.clearAll()
  })

  it('stores and retrieves a file', () => {
    skillFileStore.setFile('skill-a', 'SKILL.md', '# Hello')
    expect(skillFileStore.getFile('skill-a', 'SKILL.md')).toBe('# Hello')
  })

  it('returns undefined for missing skill', () => {
    expect(skillFileStore.getFile('nonexistent', 'file.txt')).toBeUndefined()
  })

  it('returns undefined for missing path', () => {
    skillFileStore.setFile('skill-a', 'SKILL.md', 'content')
    expect(skillFileStore.getFile('skill-a', 'other.md')).toBeUndefined()
  })

  it('lists file paths for a skill', () => {
    skillFileStore.setFile('skill-a', 'SKILL.md', 'a')
    skillFileStore.setFile('skill-a', 'script.py', 'b')
    const paths = skillFileStore.getFilePaths('skill-a')
    expect(paths).toHaveLength(2)
    expect(paths.map((p) => p.path)).toContain('SKILL.md')
    expect(paths.map((p) => p.path)).toContain('script.py')
  })

  it('stores and retrieves metadata', () => {
    const meta = { id: 'p:s', name: 'skill', pluginName: 'p', description: 'test' }
    skillFileStore.setMetadata('p:s', meta)
    expect(skillFileStore.getMetadata('p:s')).toEqual(meta)
  })

  it('returns all metadata', () => {
    skillFileStore.setMetadata('a:x', { id: 'a:x', name: 'x', pluginName: 'a', description: 'X' })
    skillFileStore.setMetadata('b:y', { id: 'b:y', name: 'y', pluginName: 'b', description: 'Y' })
    expect(skillFileStore.getAllMetadata()).toHaveLength(2)
  })

  it('clears a specific skill', () => {
    skillFileStore.setFile('skill-a', 'file.txt', 'data')
    skillFileStore.setMetadata('skill-a', { id: 'skill-a', name: 'a', pluginName: 'p', description: 'd' })
    skillFileStore.clear('skill-a')
    expect(skillFileStore.getFile('skill-a', 'file.txt')).toBeUndefined()
    expect(skillFileStore.getMetadata('skill-a')).toBeUndefined()
  })

  it('clears all data', () => {
    skillFileStore.setFile('a', 'f1', 'c1')
    skillFileStore.setFile('b', 'f2', 'c2')
    skillFileStore.setMetadata('a', { id: 'a', name: 'a', pluginName: 'p', description: 'd' })
    skillFileStore.clearAll()
    expect(skillFileStore.getAllMetadata()).toHaveLength(0)
    expect(skillFileStore.getFile('a', 'f1')).toBeUndefined()
  })

  it('hasFile returns correct boolean', () => {
    skillFileStore.setFile('s', 'f', 'c')
    expect(skillFileStore.hasFile('s', 'f')).toBe(true)
    expect(skillFileStore.hasFile('s', 'other')).toBe(false)
    expect(skillFileStore.hasFile('missing', 'f')).toBe(false)
  })
})
