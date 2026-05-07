/**
 * DiffView — inline diff viewer for file changes.
 *
 * Simple line-by-line diff: added lines in green, removed lines in
 * red, context lines in default color. Shows line numbers and the
 * file path in a header. MonacoDiffView is the primary diff viewer; this is the fallback.
 */

import { ScrollArea } from '@/components/ui/scroll-area'
import type { DiffResult } from '@/lib/vfs/types'
import { cn } from '@/lib/utils'

interface DiffViewProps {
  diff: DiffResult
}

export function DiffView({ diff }: DiffViewProps) {
  if (diff.hunks.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        No changes
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {/* File path header */}
      <div className="flex items-center gap-2 border-b border-border bg-muted/30 px-3 py-1.5">
        <span className="text-xs font-medium text-foreground">{diff.path}</span>
      </div>

      {/* Diff content */}
      <ScrollArea className="flex-1">
        <pre className="p-4 text-sm leading-relaxed">
          <code>
            {diff.hunks.map((hunk, hunkIndex) => (
              <div key={hunkIndex}>
                <div className="text-xs text-muted-foreground">
                  @@ -{hunk.oldStart},{hunk.oldLines} +{hunk.newStart},{hunk.newLines} @@
                </div>
                {hunk.lines.map((line, lineIndex) => (
                  <div
                    key={lineIndex}
                    className={cn(
                      'flex',
                      line.type === 'add' && 'bg-green-500/10 text-green-700 dark:text-green-400',
                      line.type === 'remove' && 'bg-red-500/10 text-red-700 dark:text-red-400',
                    )}
                  >
                    <span className="mr-2 inline-block w-8 select-none text-right text-muted-foreground">
                      {line.oldLineNumber ?? ''}
                    </span>
                    <span className="mr-2 inline-block w-8 select-none text-right text-muted-foreground">
                      {line.newLineNumber ?? ''}
                    </span>
                    <span className="mr-2 select-none">
                      {line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' '}
                    </span>
                    <span>{line.content}</span>
                  </div>
                ))}
              </div>
            ))}
          </code>
        </pre>
      </ScrollArea>
    </div>
  )
}
