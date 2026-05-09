import { describe, expect, it } from 'vitest'
import { encodeSkillIndex } from '../toon'

describe('encodeSkillIndex', () => {
  it('returns empty string for empty array', () => {
    expect(encodeSkillIndex([])).toBe('')
  })

  it('encodes a single skill', () => {
    const result = encodeSkillIndex([
      { id: 'plugin:review', name: 'code-review', pluginName: 'plugin', description: 'Reviews code for bugs' },
    ])
    expect(result).toBe('skills[1]{id,name,description}:\n  plugin:review,code-review,Reviews code for bugs')
  })

  it('encodes multiple skills with correct count', () => {
    const result = encodeSkillIndex([
      { id: 'a:x', name: 'skill-x', pluginName: 'a', description: 'Does X' },
      { id: 'b:y', name: 'skill-y', pluginName: 'b', description: 'Does Y' },
      { id: 'c:z', name: 'skill-z', pluginName: 'c', description: 'Does Z' },
    ])
    expect(result).toContain('skills[3]{id,name,description}:')
    expect(result).toContain('  a:x,skill-x,Does X')
    expect(result).toContain('  b:y,skill-y,Does Y')
    expect(result).toContain('  c:z,skill-z,Does Z')
  })

  it('escapes commas in description', () => {
    const result = encodeSkillIndex([{ id: 'p:s', name: 'my-skill', pluginName: 'p', description: 'Does A, B, and C' }])
    expect(result).toContain('"Does A, B, and C"')
  })

  it('escapes quotes in description', () => {
    const result = encodeSkillIndex([{ id: 'p:s', name: 'my-skill', pluginName: 'p', description: 'Uses "quotes"' }])
    expect(result).toContain('\\"quotes\\"')
  })
})
