/**
 * MonacoEditor -- lazy-loaded Monaco editor integration.
 *
 * Each open file gets its own Monaco model (keyed by repoKey:path).
 * Language is auto-detected from the file extension. Changes are
 * written back to the VFS via writeFile on every edit. Falls back
 * to EditorPlaceholder if Monaco fails to load.
 */

import { Component, Suspense, lazy, useCallback, useRef, useState, type ErrorInfo, type ReactNode } from 'react'
import type { OnMount, OnChange } from '@monaco-editor/react'
import type * as monacoNs from 'monaco-editor'
import { useIDEStore } from '@/stores/ide'
import { EditorPlaceholder } from './EditorPlaceholder'
import type { VirtualFileSystem } from '@/lib/vfs/virtual-fs'

// Lazy-load Monaco to avoid bloating the initial bundle
const Editor = lazy(() =>
  import('@monaco-editor/react').then((mod) => ({ default: mod.default })),
)

interface MonacoEditorProps {
  path: string
  content: string
  repoKey: string
  vfs: VirtualFileSystem
  readOnly?: boolean
}

/** Map file extension to Monaco language identifier. */
export function getLanguageFromPath(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? ''
  const map: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    mjs: 'javascript',
    cjs: 'javascript',
    json: 'json',
    md: 'markdown',
    mdx: 'markdown',
    css: 'css',
    scss: 'scss',
    less: 'less',
    html: 'html',
    htm: 'html',
    xml: 'xml',
    svg: 'xml',
    yaml: 'yaml',
    yml: 'yaml',
    py: 'python',
    rb: 'ruby',
    rs: 'rust',
    go: 'go',
    java: 'java',
    kt: 'kotlin',
    kts: 'kotlin',
    c: 'c',
    cpp: 'cpp',
    h: 'c',
    hpp: 'cpp',
    cs: 'csharp',
    sh: 'shell',
    bash: 'shell',
    zsh: 'shell',
    sql: 'sql',
    graphql: 'graphql',
    gql: 'graphql',
    dockerfile: 'dockerfile',
    toml: 'ini',
    ini: 'ini',
    conf: 'ini',
    txt: 'plaintext',
    log: 'plaintext',
  }

  // Handle dotfiles like Dockerfile, Makefile
  const fileName = filePath.split('/').pop()?.toLowerCase() ?? ''
  if (fileName === 'dockerfile') return 'dockerfile'
  if (fileName === 'makefile') return 'shell'

  return map[ext] ?? 'plaintext'
}

export function MonacoEditor({
  path,
  content,
  repoKey,
  vfs,
  readOnly = false,
}: MonacoEditorProps) {
  const markTabDirty = useIDEStore((s) => s.markTabDirty)
  const [loadError, setLoadError] = useState(false)
  const editorRef = useRef<monacoNs.editor.IStandaloneCodeEditor | null>(null)

  const language = getLanguageFromPath(path)
  const modelUri = `${repoKey}:${path}`

  const handleMount: OnMount = useCallback(
    (editor) => {
      editorRef.current = editor
      editor.focus()
    },
    [],
  )

  const handleChange: OnChange = useCallback(
    (value) => {
      if (readOnly || value === undefined) return
      vfs.writeFile(repoKey, path, value)
      markTabDirty(repoKey, path, true)
    },
    [vfs, repoKey, path, readOnly, markTabDirty],
  )

  if (loadError) {
    return <EditorPlaceholder path={path} content={content} repoKey={repoKey} />
  }

  return (
    <Suspense
      fallback={
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
          Loading editor...
        </div>
      }
    >
      <MonacoEditorInner
        path={modelUri}
        language={language}
        content={content}
        readOnly={readOnly}
        onMount={handleMount}
        onChange={handleChange}
        onError={() => setLoadError(true)}
      />
    </Suspense>
  )
}

/**
 * Inner component that actually renders the lazy-loaded Monaco Editor.
 * Separated to keep the error boundary logic clean.
 */
function MonacoEditorInner({
  path,
  language,
  content,
  readOnly,
  onMount,
  onChange,
  onError,
}: {
  path: string
  language: string
  content: string
  readOnly: boolean
  onMount: OnMount
  onChange: OnChange
  onError: () => void
}) {
  return (
    <ErrorCatcher onError={onError}>
      <LazyEditor
        path={path}
        language={language}
        value={content}
        options={{
          readOnly,
          minimap: { enabled: false },
          fontSize: 13,
          lineNumbers: 'on',
          scrollBeyondLastLine: false,
          wordWrap: 'on',
          automaticLayout: true,
          tabSize: 2,
          renderWhitespace: 'selection',
          bracketPairColorization: { enabled: true },
        }}
        theme="vs-dark"
        onMount={onMount}
        onChange={onChange}
      />
    </ErrorCatcher>
  )
}

/**
 * Wrapper around the lazy-loaded Editor that applies the props.
 * Uses the lazy-imported component.
 */
function LazyEditor(props: React.ComponentProps<typeof Editor>) {
  return <Editor {...props} />
}

/**
 * Simple error boundary to catch Monaco load failures.
 */

interface ErrorCatcherProps {
  onError: () => void
  children: ReactNode
}

interface ErrorCatcherState {
  hasError: boolean
}

class ErrorCatcher extends Component<ErrorCatcherProps, ErrorCatcherState> {
  state: ErrorCatcherState = { hasError: false }

  static getDerivedStateFromError(): ErrorCatcherState {
    return { hasError: true }
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {
    this.props.onError()
  }

  render() {
    if (this.state.hasError) {
      return null
    }
    return this.props.children
  }
}
