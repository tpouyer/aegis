/**
 * EditorTabs — tab bar for open files in the IDE.
 *
 * Each tab shows the filename, a dirty indicator (dot), and a close
 * button. Clicking a tab switches the active editor. The tab bar
 * scrolls horizontally when there are many open files.
 */

import { File, X } from 'lucide-react'
import { useIDEStore } from '@/stores/ide'
import { cn } from '@/lib/utils'

export function EditorTabs() {
  const { openTabs, activeTab, setActiveTab, closeTab } = useIDEStore()

  if (openTabs.length === 0) {
    return null
  }

  return (
    <div className="flex items-center overflow-x-auto border-b border-border bg-muted/30" role="tablist" aria-label="Open files">
      {openTabs.map((tab, index) => {
        const fileName = tab.path.split('/').pop() ?? tab.path
        const isActive = index === activeTab

        return (
          <div
            key={`${tab.repoKey}:${tab.path}`}
            className={cn(
              'group flex items-center gap-1.5 border-r border-border px-3 py-1.5 text-sm',
              'cursor-pointer select-none',
              isActive
                ? 'bg-background text-foreground'
                : 'text-muted-foreground hover:bg-background/50',
            )}
          >
            <button
              onClick={() => setActiveTab(index)}
              className="flex items-center gap-1.5"
              role="tab"
              aria-selected={isActive}
              aria-label={`${fileName}${tab.isDirty ? ' (modified)' : ''}`}
            >
              <File className="h-3.5 w-3.5 shrink-0" />
              <span className="whitespace-nowrap">{fileName}</span>
              {tab.isDirty && (
                <span className="h-2 w-2 rounded-full bg-primary" aria-hidden="true" />
              )}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                closeTab(index)
              }}
              className={cn(
                'rounded p-0.5 hover:bg-accent',
                isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
              )}
              aria-label={`Close ${fileName}`}
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
