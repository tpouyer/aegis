export function BoardSkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-3 p-4 md:flex-row">
      {[1, 2, 3, 4].map((col) => (
        <div
          key={col}
          className="flex h-full w-full flex-shrink-0 flex-col rounded-lg border border-border bg-muted/30 md:w-72"
        >
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <div className="h-4 w-24 animate-pulse rounded bg-muted" />
            <div className="h-4 w-6 animate-pulse rounded bg-muted" />
          </div>
          <div className="space-y-2 p-2">
            {Array.from({ length: col === 1 ? 4 : col === 2 ? 3 : 2 }).map((_, i) => (
              <div key={i} className="rounded-lg border border-border bg-card p-3 space-y-2">
                <div className="flex justify-between">
                  <div className="h-3 w-16 animate-pulse rounded bg-muted" />
                  <div className="h-3 w-3 animate-pulse rounded-full bg-muted" />
                </div>
                <div className="h-4 w-full animate-pulse rounded bg-muted" />
                <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
