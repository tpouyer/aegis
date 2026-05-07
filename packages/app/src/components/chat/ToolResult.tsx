/**
 * ToolResult — renders a tool call / result pair as a collapsible card.
 *
 * Shows the tool name and a badge indicating success or failure.
 * Expanding reveals the arguments passed and the result content.
 */

import { ChevronDown, ChevronRight, Wrench } from 'lucide-react'
import { useCallback, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { ToolCall, ToolResult as ToolResultType } from '@/lib/llm/types'

interface ToolResultProps {
  toolCall: ToolCall
  toolResult?: ToolResultType
}

export function ToolResult({ toolCall, toolResult }: ToolResultProps) {
  const [expanded, setExpanded] = useState(false)

  const toggle = useCallback(() => setExpanded((prev) => !prev), [])

  const isError = toolResult?.isError ?? false
  const isPending = !toolResult

  return (
    <Card className="my-2 border-border/50">
      <CardHeader
        className="cursor-pointer select-none p-3"
        onClick={toggle}
        onKeyDown={(e: React.KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            toggle()
          }
        }}
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
      >
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
          <Wrench className="h-4 w-4 text-muted-foreground" />
          <span className="font-mono">{toolCall.name}</span>
          {isPending ? (
            <Badge variant="secondary">Running...</Badge>
          ) : isError ? (
            <Badge variant="destructive">Error</Badge>
          ) : (
            <Badge variant="outline">Done</Badge>
          )}
        </CardTitle>
      </CardHeader>
      {expanded && (
        <CardContent className="px-3 pb-3 pt-0">
          <div className="space-y-2 text-xs">
            <div>
              <span className="font-semibold text-muted-foreground">Arguments:</span>
              <pre className="mt-1 overflow-x-auto rounded bg-muted p-2 text-muted-foreground">
                {JSON.stringify(toolCall.arguments, null, 2)}
              </pre>
            </div>
            {toolResult && (
              <div>
                <span className="font-semibold text-muted-foreground">Result:</span>
                <pre
                  className={`mt-1 overflow-x-auto rounded p-2 ${
                    isError ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {toolResult.content}
                </pre>
              </div>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  )
}
