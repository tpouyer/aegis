import type { SkillMetadata } from './types'

function escapeValue(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`
  }
  return value
}

export function encodeSkillIndex(skills: SkillMetadata[]): string {
  if (skills.length === 0) return ''

  const lines = [`skills[${skills.length}]{id,name,description}:`]
  for (const skill of skills) {
    lines.push(`  ${escapeValue(skill.id)},${escapeValue(skill.name)},${escapeValue(skill.description)}`)
  }
  return lines.join('\n')
}
