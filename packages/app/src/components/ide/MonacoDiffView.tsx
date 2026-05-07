/**
 * MonacoDiffView -- Monaco-based diff viewer for the IDE.
 *
 * Uses Monaco's built-in diff editor to show changes between
 * the original and modified content. Supports toggling between
 * inline and side-by-side diff modes. Read-only for review.
 */

import type { DiffOnMount } from '@monaco-editor/react'
import { Columns2, Rows2 } from 'lucide-react'
import { lazy, Suspense, useCallback, useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { getLanguageFromPath } from './MonacoEditor'

// Lazy-load the DiffEditor to avoid bloating the initial bundle
const DiffEditor = lazy(() =>
  import('@monaco-editor/react').then((mod) => ({
    default: mod.DiffEditor,
  })),
)

interface MonacoDiffViewProps {
  originalContent: string
  modifiedContent: string
  path: string
  language?: string
}

export function MonacoDiffView({
  originalContent,
  modifiedContent,
  path,
  language: languageOverride,
}: MonacoDiffViewProps) {
  const [isInline, setIsInline] = useState(false)
  const language = languageOverride ?? getLanguageFromPath(path)

  const handleMount: DiffOnMount = useCallback((editor) => {
    editor.focus()
  }, [])

  return (
    <div className="flex h-full flex-col">
      {/* Header with path and toggle */}
      <div className="flex items-center justify-between border-b border-border bg-muted/30 px-3 py-1.5">
        <span className="text-xs font-medium text-foreground">{path}</span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className={cn('h-6 w-6 p-0', !isInline && 'bg-accent')}
            onClick={() => setIsInline(false)}
            title="Side by side"
          >
            <Columns2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={cn('h-6 w-6 p-0', isInline && 'bg-accent')}
            onClick={() => setIsInline(true)}
            title="Inline"
          >
            <Rows2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Diff editor */}
      <div className="flex-1 overflow-hidden">
        <Suspense
          fallback={
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Loading diff editor...
            </div>
          }
        >
          <DiffEditor
            original={originalContent}
            modified={modifiedContent}
            language={language}
            theme="vs-dark"
            options={{
              readOnly: true,
              renderSideBySide: !isInline,
              minimap: { enabled: false },
              fontSize: 13,
              lineNumbers: 'on',
              scrollBeyondLastLine: false,
              automaticLayout: true,
              renderOverviewRuler: false,
            }}
            onMount={handleMount}
          />
        </Suspense>
      </div>
    </div>
  )
}
