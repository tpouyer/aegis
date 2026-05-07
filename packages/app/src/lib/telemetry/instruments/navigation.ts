import { getNavMeter } from '../meters'

const navDuration = getNavMeter().createHistogram('browser.page.navigation.duration', {
  description: 'Soft navigation duration',
  unit: 'ms',
})

const pageLoad = getNavMeter().createHistogram('browser.page.load.duration', {
  description: 'Initial full page load time',
  unit: 'ms',
})

const lcpHistogram = getNavMeter().createHistogram('browser.web_vital.lcp', {
  description: 'Largest Contentful Paint',
  unit: 'ms',
})

const fidHistogram = getNavMeter().createHistogram('browser.web_vital.fid', {
  description: 'First Input Delay',
  unit: 'ms',
})

const clsHistogram = getNavMeter().createHistogram('browser.web_vital.cls', {
  description: 'Cumulative Layout Shift',
  unit: '{score}',
})

export function instrumentNavigation(router: any): void {
  let navStartTime: number | null = null
  let sourceRoute = ''

  try {
    router.subscribe('onBeforeLoad', (event: any) => {
      navStartTime = performance.now()
      sourceRoute = event?.pathChanged ? (event?.fromLocation?.pathname ?? '') : ''
    })

    router.subscribe('onLoad', (event: any) => {
      if (navStartTime !== null) {
        const duration = performance.now() - navStartTime
        const route = event?.toLocation?.pathname ?? 'unknown'
        navDuration.record(duration, {
          'browser.page.route': route,
          'browser.page.previous_route': sourceRoute,
        })
        navStartTime = null
      }
    })
  } catch {
    // Router may not support these subscription events — fail silently
  }

  if (typeof PerformanceObserver === 'undefined') return

  try {
    new PerformanceObserver((list) => {
      const entries = list.getEntries()
      if (entries.length > 0) {
        lcpHistogram.record(entries[entries.length - 1].startTime)
      }
    }).observe({ type: 'largest-contentful-paint', buffered: true })
  } catch {
    /* not supported */
  }

  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const e = entry as any
        if (e.processingStart) {
          fidHistogram.record(e.processingStart - entry.startTime)
        }
      }
    }).observe({ type: 'first-input', buffered: true })
  } catch {
    /* not supported */
  }

  try {
    let clsValue = 0
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!(entry as any).hadRecentInput) {
          clsValue += (entry as any).value ?? 0
        }
      }
      clsHistogram.record(clsValue)
    }).observe({ type: 'layout-shift', buffered: true })
  } catch {
    /* not supported */
  }

  const navEntry = performance.getEntriesByType?.('navigation')?.[0] as PerformanceNavigationTiming | undefined
  if (navEntry?.loadEventEnd) {
    pageLoad.record(navEntry.loadEventEnd)
  }
}
