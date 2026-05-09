import type { SkillFileInfo, SkillMetadata } from './types'

class SkillFileStore {
  private files = new Map<string, Map<string, string>>()
  private metadata = new Map<string, SkillMetadata>()

  setFile(skillId: string, path: string, content: string): void {
    let skillFiles = this.files.get(skillId)
    if (!skillFiles) {
      skillFiles = new Map()
      this.files.set(skillId, skillFiles)
    }
    skillFiles.set(path, content)
  }

  getFile(skillId: string, path: string): string | undefined {
    return this.files.get(skillId)?.get(path)
  }

  hasFile(skillId: string, path: string): boolean {
    return this.files.get(skillId)?.has(path) ?? false
  }

  getFilePaths(skillId: string): SkillFileInfo[] {
    const skillFiles = this.files.get(skillId)
    if (!skillFiles) return []
    return Array.from(skillFiles.entries()).map(([path, content]) => ({ path, size: content.length }))
  }

  setMetadata(skillId: string, meta: SkillMetadata): void {
    this.metadata.set(skillId, meta)
  }

  getMetadata(skillId: string): SkillMetadata | undefined {
    return this.metadata.get(skillId)
  }

  getAllMetadata(): SkillMetadata[] {
    return Array.from(this.metadata.values())
  }

  clear(skillId: string): void {
    this.files.delete(skillId)
    this.metadata.delete(skillId)
  }

  clearAll(): void {
    this.files.clear()
    this.metadata.clear()
  }
}

export const skillFileStore = new SkillFileStore()
