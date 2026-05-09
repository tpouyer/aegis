import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Activity, Bug } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { MeterSection } from '@/components/devel/MeterSection'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { isDevelEnabled } from '@/lib/telemetry/config'
import { useMetricsStore } from '@/stores/metrics'

export const Route = createFileRoute('/devel')({
  component: DevelPage,
})

const METER_LABELS: Record<string, string> = {
  'aegis.http': 'HTTP',
  'aegis.llm': 'LLM',
  'aegis.mcp': 'MCP',
  'aegis.skills': 'Skills',
  'aegis.tool_router': 'Router',
  'aegis.workspace': 'Workspace',
  'aegis.board': 'Board',
  'aegis.navigation': 'Navigation',
  'aegis.sw': 'SW',
}

function DevelPage() {
  const navigate = useNavigate()

  useEffect(() => {
    if (!isDevelEnabled()) {
      navigate({ to: '/' })
    }
  }, [navigate])

  useEffect(() => {
    document.title = 'Developer Dashboard — Aegis'
  }, [])

  const byMeter = useMetricsStore((s) => s.byMeter)
  const lastUpdated = useMetricsStore((s) => s.lastUpdated)

  const meterNames = useMemo(() => {
    const allNames = Object.keys(METER_LABELS)
    const withData = Array.from(byMeter.keys())
    const combined = new Set([...withData, ...allNames])
    return Array.from(combined).sort()
  }, [byMeter])

  const timeSinceUpdate = lastUpdated > 0 ? Math.round((Date.now() - lastUpdated) / 1000) : null

  if (!isDevelEnabled()) return null

  return (
    <div className="mx-auto max-w-7xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Bug className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Developer Dashboard</h1>
            <p className="text-sm text-muted-foreground">Real-time OpenTelemetry metrics from Aegis</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Activity
            className={`h-4 w-4 ${lastUpdated > 0 ? 'animate-pulse text-green-500' : 'text-muted-foreground'}`}
          />
          {timeSinceUpdate !== null ? (
            <span className="text-xs text-muted-foreground">Updated {timeSinceUpdate}s ago</span>
          ) : (
            <span className="text-xs text-muted-foreground">Waiting for data...</span>
          )}
          <Badge variant="outline" className="text-xs">
            {byMeter.size} meters
          </Badge>
        </div>
      </div>

      <Tabs defaultValue={meterNames[0] ?? 'aegis.http'} className="w-full">
        <TabsList className="mb-4 flex-wrap">
          {meterNames.map((name) => {
            const metrics = byMeter.get(name)
            const hasData = metrics && metrics.length > 0
            return (
              <TabsTrigger key={name} value={name} className="gap-1">
                {METER_LABELS[name] ?? name}
                {hasData && (
                  <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
                    {metrics.length}
                  </Badge>
                )}
              </TabsTrigger>
            )
          })}
        </TabsList>

        {meterNames.map((name) => (
          <TabsContent key={name} value={name}>
            <MeterSection meterName={name} metrics={byMeter.get(name) ?? []} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
