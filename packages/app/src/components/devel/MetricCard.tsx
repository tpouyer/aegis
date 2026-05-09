import { ArrowDown, ArrowUp, Hash, Timer } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { MetricSnapshot } from '@/stores/metrics'
import { Sparkline } from './Sparkline'

interface MetricCardProps {
  metric: MetricSnapshot
}

export function MetricCard({ metric }: MetricCardProps) {
  const latestPoints = metric.dataPoints
  const totalValue = latestPoints.reduce((sum, dp) => sum + dp.value, 0)
  const avgValue = latestPoints.length > 0 ? totalValue / latestPoints.length : 0
  const maxValue = latestPoints.length > 0 ? Math.max(...latestPoints.map((dp) => dp.value)) : 0

  const isHistogram = metric.type === 'histogram'
  const isUpDown = metric.type === 'up_down_counter'

  const displayValue = isHistogram ? avgValue : totalValue
  const formattedValue = metric.unit === 'ms' ? `${displayValue.toFixed(1)}ms` : formatNumber(displayValue)

  const Icon = isHistogram ? Timer : isUpDown ? ArrowUp : Hash

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <Icon className="h-3.5 w-3.5" />
          {metric.name}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-end justify-between">
          <span className="text-2xl font-bold text-foreground">{formattedValue}</span>
          {metric.unit && <span className="text-xs text-muted-foreground">{metric.unit}</span>}
        </div>

        {isHistogram && latestPoints.length > 0 && (
          <div className="flex gap-3 text-xs text-muted-foreground">
            <span>cnt: {latestPoints.length}</span>
            <span>max: {metric.unit === 'ms' ? `${maxValue.toFixed(0)}ms` : formatNumber(maxValue)}</span>
          </div>
        )}

        {isUpDown && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            {totalValue > 0 ? (
              <ArrowUp className="h-3 w-3 text-green-500" />
            ) : (
              <ArrowDown className="h-3 w-3 text-red-500" />
            )}
            <span>current</span>
          </div>
        )}

        {metric.history.length >= 2 && (
          <div className="pt-1">
            <Sparkline values={metric.history} width={160} height={28} className="text-primary" />
          </div>
        )}

        {latestPoints.length > 0 &&
          latestPoints[0].attributes &&
          Object.keys(latestPoints[0].attributes).length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {Object.entries(latestPoints[0].attributes)
                .slice(0, 3)
                .map(([k, v]) => (
                  <span key={k} className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    {k}={String(v).slice(0, 20)}
                  </span>
                ))}
            </div>
          )}
      </CardContent>
    </Card>
  )
}

function formatNumber(n: number): string {
  if (n === 0) return '0'
  if (Number.isInteger(n)) return n.toLocaleString()
  return n.toFixed(2)
}
