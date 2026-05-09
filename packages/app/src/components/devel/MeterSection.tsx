import type { MetricSnapshot } from '@/stores/metrics'
import { MetricCard } from './MetricCard'

interface MeterSectionProps {
  meterName: string
  metrics: MetricSnapshot[]
}

export function MeterSection({ meterName, metrics }: MeterSectionProps) {
  if (metrics.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        No data yet for <code className="rounded bg-muted px-1.5 py-0.5">{meterName}</code>. Interact with the app to
        generate metrics.
      </div>
    )
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {metrics.map((m) => (
        <MetricCard key={m.name} metric={m} />
      ))}
    </div>
  )
}
