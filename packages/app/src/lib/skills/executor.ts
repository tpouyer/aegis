import type { PyodideInterface } from 'pyodide'
import { recordPyodideLoad, recordScriptExecutionStart } from '@/lib/telemetry/instruments/skills'

const DEBUG = import.meta.env.DEV

function log(msg: string, ...args: unknown[]) {
  if (DEBUG) console.debug(`[skill-executor] ${msg}`, ...args)
}

export interface ExecutionResult {
  stdout: string
  stderr: string
  exitCode: number
  changedFiles?: Map<string, string>
}

class SkillExecutor {
  private pyodide: PyodideInterface | null = null
  private pyodideLoading: Promise<PyodideInterface> | null = null

  async ensurePyodide(): Promise<PyodideInterface> {
    if (this.pyodide) return this.pyodide
    if (this.pyodideLoading) return this.pyodideLoading

    log('loading Pyodide runtime...')
    const pyodideMetric = recordPyodideLoad()
    this.pyodideLoading = this.loadPyodide()
    this.pyodide = await this.pyodideLoading
    this.pyodideLoading = null
    pyodideMetric.end()
    log('Pyodide ready')
    return this.pyodide
  }

  private async loadPyodide(): Promise<PyodideInterface> {
    const { loadPyodide } = await import('pyodide')
    return loadPyodide({
      indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.27.7/full/',
    })
  }

  async executePython(
    script: string,
    workspaceFiles?: Map<string, string>,
    skillFiles?: Map<string, string>,
    cwd?: string,
  ): Promise<ExecutionResult> {
    const scriptMetric = recordScriptExecutionStart('python')
    const pyodide = await this.ensurePyodide()
    const stdoutChunks: string[] = []
    const stderrChunks: string[] = []

    pyodide.setStdout({ batched: (line) => stdoutChunks.push(line) })
    pyodide.setStderr({ batched: (line) => stderrChunks.push(line) })

    const snapshotPaths = new Set<string>()

    try {
      if (workspaceFiles) {
        pyodide.FS.mkdirTree('/workspace')
        for (const [path, content] of workspaceFiles) {
          const fullPath = `/workspace/${path}`
          const dir = fullPath.substring(0, fullPath.lastIndexOf('/'))
          pyodide.FS.mkdirTree(dir)
          pyodide.FS.writeFile(fullPath, content)
          snapshotPaths.add(fullPath)
        }
      }

      if (skillFiles) {
        pyodide.FS.mkdirTree('/skill')
        for (const [path, content] of skillFiles) {
          const fullPath = `/skill/${path}`
          const dir = fullPath.substring(0, fullPath.lastIndexOf('/'))
          pyodide.FS.mkdirTree(dir)
          pyodide.FS.writeFile(fullPath, content)
        }
      }

      const workDir = cwd ?? '/workspace'
      const wrappedScript = `
import os
os.chdir('${workDir}')
${script}
`
      await pyodide.runPythonAsync(wrappedScript)

      const changedFiles = this.detectChangedFiles(pyodide, snapshotPaths, workspaceFiles)

      scriptMetric.end(0)
      return {
        stdout: stdoutChunks.join('\n'),
        stderr: stderrChunks.join('\n'),
        exitCode: 0,
        changedFiles: changedFiles.size > 0 ? changedFiles : undefined,
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      scriptMetric.end(1)
      return {
        stdout: stdoutChunks.join('\n'),
        stderr: stderrChunks.length > 0 ? stderrChunks.join('\n') : message,
        exitCode: 1,
      }
    }
  }

  private detectChangedFiles(
    pyodide: PyodideInterface,
    snapshotPaths: Set<string>,
    originalFiles?: Map<string, string>,
  ): Map<string, string> {
    const changed = new Map<string, string>()
    if (!originalFiles) return changed

    const wsFiles = this.listFilesRecursive(pyodide, '/workspace')

    for (const fullPath of wsFiles) {
      const relativePath = fullPath.substring('/workspace/'.length)
      try {
        const newContent = pyodide.FS.readFile(fullPath, { encoding: 'utf8' }) as string
        const original = originalFiles.get(relativePath)
        if (original === undefined || original !== newContent) {
          changed.set(relativePath, newContent)
        }
      } catch {
        // skip unreadable files
      }
    }

    return changed
  }

  private listFilesRecursive(pyodide: PyodideInterface, dir: string): string[] {
    const results: string[] = []
    try {
      const entries = pyodide.FS.readdir(dir).filter((e: string) => e !== '.' && e !== '..')
      for (const entry of entries) {
        const fullPath = `${dir}/${entry}`
        const stat = pyodide.FS.stat(fullPath)
        if (pyodide.FS.isDir(stat.mode)) {
          results.push(...this.listFilesRecursive(pyodide, fullPath))
        } else {
          results.push(fullPath)
        }
      }
    } catch {
      // directory doesn't exist or unreadable
    }
    return results
  }

  async executeBash(script: string, workspaceFiles?: Map<string, string>): Promise<ExecutionResult> {
    const bashMetric = recordScriptExecutionStart('bash')
    const shell = (await import('shelljs')) as {
      config: { silent: boolean }
      mkdir: (flags: string, dir: string) => void
      cd: (dir: string) => void
      exec: (cmd: string) => { code: number; stdout: string; stderr: string }
      find: (path: string) => string[]
      test: (flag: string, path: string) => boolean
      cat: (path: string) => { toString: () => string }
      rm: (flags: string, path: string) => void
      ShellString: (str: string) => { to: (path: string) => void }
    }

    const stdoutChunks: string[] = []
    shell.config.silent = true

    if (workspaceFiles) {
      shell.mkdir('-p', '/tmp/aegis-workspace')
      for (const [path, content] of workspaceFiles) {
        const fullPath = `/tmp/aegis-workspace/${path}`
        const dir = fullPath.substring(0, fullPath.lastIndexOf('/'))
        shell.mkdir('-p', dir)
        shell.ShellString(content).to(fullPath)
      }
      shell.cd('/tmp/aegis-workspace')
    }

    const lines = script.split('\n').filter((l) => l.trim() && !l.trim().startsWith('#'))

    let exitCode = 0

    for (const line of lines) {
      const trimmed = line.trim()

      if (trimmed.startsWith('python3 ') || trimmed.startsWith('python ')) {
        const scriptPath = trimmed.replace(/^python3?\s+/, '')
        const pyScript = workspaceFiles?.get(scriptPath) ?? ''
        if (pyScript) {
          const pyResult = await this.executePython(pyScript, workspaceFiles)
          stdoutChunks.push(pyResult.stdout)
          if (pyResult.stderr) stdoutChunks.push(pyResult.stderr)
          exitCode = pyResult.exitCode
        } else {
          stdoutChunks.push(`python: can't open file '${scriptPath}'`)
          exitCode = 1
        }
        continue
      }

      const result = shell.exec(trimmed)
      if (result.stdout) stdoutChunks.push(result.stdout)
      if (result.stderr) stdoutChunks.push(result.stderr)
      exitCode = result.code
    }

    const changedFiles = new Map<string, string>()
    if (workspaceFiles) {
      const resultFiles = shell.find('/tmp/aegis-workspace').filter((f) => shell.test('-f', f))
      for (const fullPath of resultFiles) {
        const relativePath = fullPath.replace('/tmp/aegis-workspace/', '')
        const newContent = shell.cat(fullPath).toString()
        const original = workspaceFiles.get(relativePath)
        if (original === undefined || original !== newContent) {
          changedFiles.set(relativePath, newContent)
        }
      }
      shell.rm('-rf', '/tmp/aegis-workspace')
    }

    bashMetric.end(exitCode)
    return {
      stdout: stdoutChunks.join('\n'),
      stderr: '',
      exitCode,
      changedFiles: changedFiles.size > 0 ? changedFiles : undefined,
    }
  }
}

export const skillExecutor = new SkillExecutor()
