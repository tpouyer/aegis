/**
 * IDE component tests.
 *
 * Tests for MonacoEditor, ApplyBlock, SourceControl, and the
 * file-extension-to-language mapping utility.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { getLanguageFromPath } from '../MonacoEditor'
import { useIDEStore } from '@/stores/ide'

// ── Mock @monaco-editor/react ─────────────────────────────────────
// Monaco cannot load in jsdom, so we provide lightweight stubs.

vi.mock('@monaco-editor/react', () => ({
  default: function MockEditor(props: {
    value?: string
    language?: string
    path?: string
    options?: { readOnly?: boolean }
    onChange?: (value: string) => void
  }) {
    return (
      <div data-testid="monaco-editor" data-language={props.language} data-path={props.path}>
        <textarea
          data-testid="monaco-textarea"
          value={props.value}
          readOnly={props.options?.readOnly}
          onChange={(e) => props.onChange?.(e.target.value)}
        />
      </div>
    )
  },
  DiffEditor: function MockDiffEditor(props: {
    original?: string
    modified?: string
    language?: string
    options?: { renderSideBySide?: boolean }
  }) {
    return (
      <div
        data-testid="monaco-diff-editor"
        data-language={props.language}
        data-side-by-side={String(props.options?.renderSideBySide ?? true)}
      >
        <div data-testid="diff-original">{props.original}</div>
        <div data-testid="diff-modified">{props.modified}</div>
      </div>
    )
  },
}))

// ── Mock VFS ──────────────────────────────────────────────────────
function createMockVfs(overrides: Record<string, unknown> = {}) {
  return {
    readFile: vi.fn().mockResolvedValue('file content'),
    writeFile: vi.fn(),
    getChanges: vi.fn().mockReturnValue([]),
    getDiff: vi.fn().mockReturnValue({ path: '', hunks: [] }),
    commit: vi.fn().mockResolvedValue('abc1234'),
    createPR: vi.fn().mockResolvedValue({ htmlUrl: 'https://github.com/test/pr/1' }),
    ...overrides,
  } as any
}

// Reset the IDE store between tests
afterEach(() => {
  useIDEStore.setState({
    openTabs: [],
    activeTab: -1,
    explorerExpandedPaths: new Set(),
    showDiff: false,
    commitMessage: '',
    activeRepo: null,
  })
})

// ── getLanguageFromPath ───────────────────────────────────────────

describe('getLanguageFromPath', () => {
  it('maps .ts and .tsx to typescript', () => {
    expect(getLanguageFromPath('src/index.ts')).toBe('typescript')
    expect(getLanguageFromPath('src/App.tsx')).toBe('typescript')
  })

  it('maps .js, .jsx, .mjs, .cjs to javascript', () => {
    expect(getLanguageFromPath('index.js')).toBe('javascript')
    expect(getLanguageFromPath('Component.jsx')).toBe('javascript')
    expect(getLanguageFromPath('config.mjs')).toBe('javascript')
    expect(getLanguageFromPath('config.cjs')).toBe('javascript')
  })

  it('maps .json to json', () => {
    expect(getLanguageFromPath('package.json')).toBe('json')
  })

  it('maps .md to markdown', () => {
    expect(getLanguageFromPath('README.md')).toBe('markdown')
  })

  it('maps .css, .scss, .less to their languages', () => {
    expect(getLanguageFromPath('styles.css')).toBe('css')
    expect(getLanguageFromPath('styles.scss')).toBe('scss')
    expect(getLanguageFromPath('styles.less')).toBe('less')
  })

  it('maps .py to python', () => {
    expect(getLanguageFromPath('script.py')).toBe('python')
  })

  it('maps .yaml and .yml to yaml', () => {
    expect(getLanguageFromPath('config.yaml')).toBe('yaml')
    expect(getLanguageFromPath('config.yml')).toBe('yaml')
  })

  it('maps .html and .htm to html', () => {
    expect(getLanguageFromPath('index.html')).toBe('html')
    expect(getLanguageFromPath('page.htm')).toBe('html')
  })

  it('returns plaintext for unknown extensions', () => {
    expect(getLanguageFromPath('file.xyz')).toBe('plaintext')
    expect(getLanguageFromPath('file')).toBe('plaintext')
  })

  it('handles Dockerfile by filename', () => {
    expect(getLanguageFromPath('Dockerfile')).toBe('dockerfile')
    expect(getLanguageFromPath('path/to/Dockerfile')).toBe('dockerfile')
  })

  it('maps .go to go', () => {
    expect(getLanguageFromPath('main.go')).toBe('go')
  })

  it('maps .rs to rust', () => {
    expect(getLanguageFromPath('lib.rs')).toBe('rust')
  })

  it('maps .java to java', () => {
    expect(getLanguageFromPath('Main.java')).toBe('java')
  })

  it('maps .sh to shell', () => {
    expect(getLanguageFromPath('script.sh')).toBe('shell')
  })
})

// ── MonacoEditor ──────────────────────────────────────────────────

describe('MonacoEditor', () => {
  it('renders without crashing', async () => {
    // Dynamic import after mocks are set up
    const { MonacoEditor } = await import('../MonacoEditor')
    const vfs = createMockVfs()

    render(
      <MonacoEditor
        path="src/index.ts"
        content="const x = 1;"
        repoKey="org/repo"
        vfs={vfs}
      />,
    )

    // Wait for lazy-loaded editor to appear
    await waitFor(() => {
      expect(screen.getByTestId('monaco-editor')).toBeInTheDocument()
    })
  })

  it('passes the correct language based on file extension', async () => {
    const { MonacoEditor } = await import('../MonacoEditor')
    const vfs = createMockVfs()

    render(
      <MonacoEditor
        path="styles/main.css"
        content="body { color: red; }"
        repoKey="org/repo"
        vfs={vfs}
      />,
    )

    await waitFor(() => {
      const editor = screen.getByTestId('monaco-editor')
      expect(editor.dataset.language).toBe('css')
    })
  })

  it('calls vfs.writeFile on change when not readOnly', async () => {
    const { MonacoEditor } = await import('../MonacoEditor')
    const vfs = createMockVfs()

    render(
      <MonacoEditor
        path="src/index.ts"
        content="const x = 1;"
        repoKey="org/repo"
        vfs={vfs}
      />,
    )

    await waitFor(() => {
      expect(screen.getByTestId('monaco-textarea')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByTestId('monaco-textarea'), {
      target: { value: 'const x = 2;' },
    })

    expect(vfs.writeFile).toHaveBeenCalledWith('org/repo', 'src/index.ts', 'const x = 2;')
  })
})

// ── ApplyBlock ────────────────────────────────────────────────────

describe('ApplyBlock', () => {
  it('renders the code preview and Apply button in idle state', async () => {
    const { ApplyBlock } = await import('../ApplyBlock')
    const vfs = createMockVfs()

    render(
      <ApplyBlock
        proposedContent="const y = 2;"
        currentContent="const x = 1;"
        path="src/index.ts"
        repoKey="org/repo"
        vfs={vfs}
      />,
    )

    expect(screen.getByText('Apply')).toBeInTheDocument()
    expect(screen.getByText('const y = 2;')).toBeInTheDocument()
  })

  it('shows diff view when Apply is clicked', async () => {
    const { ApplyBlock } = await import('../ApplyBlock')
    const vfs = createMockVfs()

    render(
      <ApplyBlock
        proposedContent="const y = 2;"
        currentContent="const x = 1;"
        path="src/index.ts"
        repoKey="org/repo"
        vfs={vfs}
      />,
    )

    fireEvent.click(screen.getByText('Apply'))

    // Should now show the review view with Accept/Reject
    await waitFor(() => {
      expect(screen.getByText('Review changes')).toBeInTheDocument()
      expect(screen.getByText('Accept')).toBeInTheDocument()
      expect(screen.getByText('Reject')).toBeInTheDocument()
    })
  })

  it('writes to VFS and shows accepted state when Accept is clicked', async () => {
    const { ApplyBlock } = await import('../ApplyBlock')
    const vfs = createMockVfs()

    render(
      <ApplyBlock
        proposedContent="const y = 2;"
        currentContent="const x = 1;"
        path="src/index.ts"
        repoKey="org/repo"
        vfs={vfs}
      />,
    )

    fireEvent.click(screen.getByText('Apply'))

    await waitFor(() => {
      expect(screen.getByText('Accept')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Accept'))

    expect(vfs.writeFile).toHaveBeenCalledWith('org/repo', 'src/index.ts', 'const y = 2;')
    expect(screen.getByText(/Applied to/)).toBeInTheDocument()
  })

  it('shows rejected state when Reject is clicked', async () => {
    const { ApplyBlock } = await import('../ApplyBlock')
    const vfs = createMockVfs()

    render(
      <ApplyBlock
        proposedContent="const y = 2;"
        currentContent="const x = 1;"
        path="src/index.ts"
        repoKey="org/repo"
        vfs={vfs}
      />,
    )

    fireEvent.click(screen.getByText('Apply'))

    await waitFor(() => {
      expect(screen.getByText('Reject')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Reject'))

    expect(vfs.writeFile).not.toHaveBeenCalled()
    expect(screen.getByText('Change dismissed')).toBeInTheDocument()
  })
})

// ── SourceControl ─────────────────────────────────────────────────

describe('SourceControl', () => {
  it('disables commit button when there are no changes', async () => {
    const { SourceControl } = await import('../SourceControl')

    render(
      <SourceControl
        changes={[]}
        repoKey="org/repo"
        onCommit={vi.fn().mockResolvedValue('sha')}
        onCreatePR={vi.fn().mockResolvedValue('url')}
        onFileClick={vi.fn()}
      />,
    )

    expect(screen.getByText('No changes')).toBeInTheDocument()
  })

  it('disables commit button when commit message is empty', async () => {
    const { SourceControl } = await import('../SourceControl')

    render(
      <SourceControl
        changes={[
          { path: 'file.ts', status: 'modified', repo: 'org/repo' },
        ]}
        repoKey="org/repo"
        onCommit={vi.fn().mockResolvedValue('sha')}
        onCreatePR={vi.fn().mockResolvedValue('url')}
        onFileClick={vi.fn()}
      />,
    )

    const commitBtn = screen.getByRole('button', { name: /Commit/ })
    expect(commitBtn).toBeDisabled()
  })

  it('enables commit button when there are changes and a message', async () => {
    const { SourceControl } = await import('../SourceControl')

    // Set commit message in the store
    useIDEStore.setState({ commitMessage: 'fix: update logic' })

    render(
      <SourceControl
        changes={[
          { path: 'file.ts', status: 'modified', repo: 'org/repo' },
        ]}
        repoKey="org/repo"
        onCommit={vi.fn().mockResolvedValue('sha')}
        onCreatePR={vi.fn().mockResolvedValue('url')}
        onFileClick={vi.fn()}
      />,
    )

    const commitBtn = screen.getByRole('button', { name: /Commit/ })
    expect(commitBtn).not.toBeDisabled()
  })

  it('shows commit SHA after successful commit', async () => {
    const { SourceControl } = await import('../SourceControl')

    useIDEStore.setState({ commitMessage: 'fix: update logic' })

    const onCommit = vi.fn().mockResolvedValue('abc1234def5678')

    render(
      <SourceControl
        changes={[
          { path: 'file.ts', status: 'modified', repo: 'org/repo' },
        ]}
        repoKey="org/repo"
        onCommit={onCommit}
        onCreatePR={vi.fn().mockResolvedValue('url')}
        onFileClick={vi.fn()}
      />,
    )

    const commitBtn = screen.getByRole('button', { name: /Commit/ })
    fireEvent.click(commitBtn)

    await waitFor(() => {
      expect(screen.getByText('abc1234')).toBeInTheDocument()
    })
  })

  it('shows error message when commit fails', async () => {
    const { SourceControl } = await import('../SourceControl')

    useIDEStore.setState({ commitMessage: 'fix: update logic' })

    const onCommit = vi.fn().mockRejectedValue(new Error('Network error'))

    render(
      <SourceControl
        changes={[
          { path: 'file.ts', status: 'modified', repo: 'org/repo' },
        ]}
        repoKey="org/repo"
        onCommit={onCommit}
        onCreatePR={vi.fn().mockResolvedValue('url')}
        onFileClick={vi.fn()}
      />,
    )

    const commitBtn = screen.getByRole('button', { name: /Commit/ })
    fireEvent.click(commitBtn)

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument()
    })
  })

  it('shows PR URL after successful PR creation', async () => {
    const { SourceControl } = await import('../SourceControl')

    const onCreatePR = vi.fn().mockResolvedValue('https://github.com/org/repo/pull/42')

    render(
      <SourceControl
        changes={[
          { path: 'file.ts', status: 'modified', repo: 'org/repo' },
        ]}
        repoKey="org/repo"
        onCommit={vi.fn().mockResolvedValue('sha')}
        onCreatePR={onCreatePR}
        onFileClick={vi.fn()}
      />,
    )

    const prBtn = screen.getByRole('button', { name: /Create PR/ })
    fireEvent.click(prBtn)

    await waitFor(() => {
      expect(screen.getByText('PR created')).toBeInTheDocument()
      const viewLink = screen.getByText('View')
      expect(viewLink.closest('a')).toHaveAttribute(
        'href',
        'https://github.com/org/repo/pull/42',
      )
    })
  })

  it('displays file change status badges correctly', async () => {
    const { SourceControl } = await import('../SourceControl')

    render(
      <SourceControl
        changes={[
          { path: 'new-file.ts', status: 'added', repo: 'org/repo' },
          { path: 'changed.ts', status: 'modified', repo: 'org/repo' },
          { path: 'removed.ts', status: 'deleted', repo: 'org/repo' },
        ]}
        repoKey="org/repo"
        onCommit={vi.fn().mockResolvedValue('sha')}
        onCreatePR={vi.fn().mockResolvedValue('url')}
        onFileClick={vi.fn()}
      />,
    )

    expect(screen.getByText('A')).toBeInTheDocument()
    expect(screen.getByText('M')).toBeInTheDocument()
    expect(screen.getByText('D')).toBeInTheDocument()
  })
})
