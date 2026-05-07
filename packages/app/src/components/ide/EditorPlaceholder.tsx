/**
 * EditorPlaceholder — read-only file content viewer.
 *
 * Fallback viewer when Monaco is not loaded.
 * Shows file content as preformatted text with line numbers
 * and the file path in a header bar.
 */

import { File } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'

interface EditorPlaceholderProps {
  path: string
  content: string
  repoKey: string
}

export function EditorPlaceholder({ path, content, repoKey }: EditorPlaceholderProps) {
  const lines = content.split('\n')
  const lineNumberWidth = String(lines.length).length

  return (
    <div className="flex h-full flex-col">
      {/* File path header */}
      <div className="flex items-center gap-2 border-b border-border bg-muted/30 px-3 py-1.5">
        <File className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">{repoKey}</span>
        <span className="text-xs text-muted-foreground">/</span>
        <span className="text-xs text-foreground">{path}</span>
      </div>

      {/* File content */}
      <ScrollArea className="flex-1">
        <pre className="p-4 text-sm leading-relaxed">
          <code>
            {lines.map((line, index) => (
              <div key={index} className="flex">
                <span
                  className="mr-4 inline-block select-none text-right text-muted-foreground"
                  style={{ width: `${lineNumberWidth}ch` }}
                >
                  {index + 1}
                </span>
                <span className="text-foreground">{line}</span>
              </div>
            ))}
          </code>
        </pre>
      </ScrollArea>
    </div>
  )
}
