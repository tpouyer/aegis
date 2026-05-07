/**
 * ApplyBlock -- AI code suggestion apply flow.
 *
 * When AI generates a code block in the IDE chat panel, this
 * component wraps it and shows an [Apply] button. Clicking Apply
 * opens a Monaco diff view comparing the proposed content against
 * the current file. The user can Accept (writes to VFS) or Reject
 * (dismisses). Undo is supported via Monaco's built-in undo stack.
 */

import { Check, Code, Eye, X } from 'lucide-react'
import { lazy, Suspense, useCallback, useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { VirtualFileSystem } from '@/lib/vfs/virtual-fs'
import { useIDEStore } from '@/stores/ide'

// Lazy-load the diff view only when Apply is clicked
const MonacoDiffView = lazy(() =>
  import('./MonacoDiffView').then((mod) => ({
    default: mod.MonacoDiffView,
  })),
)

type ApplyState = 'idle' | 'reviewing' | 'accepted' | 'rejected'

interface ApplyBlockProps {
  /** The AI-proposed code content. */
  proposedContent: string
  /** The current content of the file (before applying). */
  currentContent: string
  /** The file path to apply to. */
  path: string
  /** The repo key (owner/repo). */
  repoKey: string
  /** VFS instance for writing accepted changes. */
  vfs: VirtualFileSystem
  /** The language for syntax highlighting in the code preview. */
  language?: string
}

export function ApplyBlock({ proposedContent, currentContent, path, repoKey, vfs, language }: ApplyBlockProps) {
  const [state, setState] = useState<ApplyState>('idle')
  const markTabDirty = useIDEStore((s) => s.markTabDirty)

  const handleApply = useCallback(() => {
    setState('reviewing')
  }, [])

  const handleAccept = useCallback(() => {
    vfs.writeFile(repoKey, path, proposedContent)
    markTabDirty(repoKey, path, true)
    setState('accepted')
  }, [vfs, repoKey, path, proposedContent, markTabDirty])

  const handleReject = useCallback(() => {
    setState('rejected')
  }, [])

  // Already applied or rejected -- show status badge
  if (state === 'accepted') {
    return (
      <div className="my-2 rounded-md border border-green-500/30 bg-green-500/5 p-3">
        <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
          <Check className="h-4 w-4" />
          <span>
            Applied to <code className="rounded bg-muted px-1 py-0.5 text-xs">{path}</code>
          </span>
        </div>
      </div>
    )
  }

  if (state === 'rejected') {
    return (
      <div className="my-2 rounded-md border border-muted bg-muted/20 p-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <X className="h-4 w-4" />
          <span>Change dismissed</span>
        </div>
      </div>
    )
  }

  // Reviewing -- show diff view with accept/reject buttons
  if (state === 'reviewing') {
    return (
      <div className="my-2 overflow-hidden rounded-md border border-border">
        <div className="flex items-center justify-between border-b border-border bg-muted/30 px-3 py-2">
          <div className="flex items-center gap-2 text-sm">
            <Eye className="h-4 w-4 text-muted-foreground" />
            <span className="text-foreground">Review changes</span>
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">{path}</code>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs" onClick={handleReject}>
              <X className="h-3 w-3" />
              Reject
            </Button>
            <Button size="sm" className="h-7 gap-1.5 text-xs" onClick={handleAccept}>
              <Check className="h-3 w-3" />
              Accept
            </Button>
          </div>
        </div>
        <div className="h-64">
          <Suspense
            fallback={
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Loading diff...
              </div>
            }
          >
            <MonacoDiffView
              originalContent={currentContent}
              modifiedContent={proposedContent}
              path={path}
              language={language}
            />
          </Suspense>
        </div>
      </div>
    )
  }

  // Idle -- show code preview with Apply button
  return (
    <div className="my-2 overflow-hidden rounded-md border border-border">
      <div className="flex items-center justify-between border-b border-border bg-muted/30 px-2 py-1.5">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Code className="h-3.5 w-3.5" />
          <span>{path}</span>
        </div>
        <Button size="sm" className={cn('h-6 gap-1 px-2 text-xs')} onClick={handleApply}>
          Apply
        </Button>
      </div>
      <pre className="max-h-48 overflow-auto bg-muted/10 p-3 text-xs leading-relaxed">
        <code>{proposedContent}</code>
      </pre>
    </div>
  )
}
