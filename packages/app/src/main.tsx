import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRouter, RouterProvider } from '@tanstack/react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { authManager } from './lib/auth/manager'
import { CacheStore } from './lib/cache/indexeddb'
import { initJiraClient } from './lib/jira/client'
import { restoreProviders } from './lib/llm/restore-providers'
import { loadWellKnownConfig } from './lib/telemetry/config'
import { initTelemetry } from './lib/telemetry/init'
import { instrumentNavigation } from './lib/telemetry/instruments/navigation'
import { routeTree } from './routeTree.gen'
import { useJiraConfigStore } from './stores/jira-config'
import './app.css'

authManager.clearExpiredTokens()
new CacheStore('aegis-chat', 'sessions').evictExpired().catch(() => {})
new CacheStore('aegis-jira', 'cache').evictExpired().catch(() => {})

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      retry: 1,
    },
  },
})

;(window as any).__aegis_queryClient = queryClient

const basepath = import.meta.env.BASE_URL?.replace(/\/$/, '') || ''
const router = createRouter({ routeTree, basepath })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

const rootElement = document.getElementById('root')!

async function bootstrap() {
  // Register Service Worker and sync persisted tokens to it
  if ('serviceWorker' in navigator) {
    const swUrl = `${import.meta.env.BASE_URL || '/'}sw.js`
    navigator.serviceWorker.register(swUrl, { scope: import.meta.env.BASE_URL || '/' }).catch(() => {})

    // Sync tokens once SW is ready (with timeout so the app isn't blocked)
    Promise.race([navigator.serviceWorker.ready, new Promise((r) => setTimeout(r, 3000))]).then(() =>
      authManager.syncAllTokensToSW().catch(() => {}),
    )
  }

  // Load .well-known config before Jira client init — the client reads
  // githubTokenProxyUrl from it to route API token auth through the CORS proxy.
  await loadWellKnownConfig()

  restoreProviders()

  const jiraConfig = useJiraConfigStore.getState().config
  if (jiraConfig) {
    initJiraClient({
      baseUrl: jiraConfig.baseUrl,
      email: jiraConfig.email,
      apiToken: jiraConfig.apiToken,
    })
  }

  await initTelemetry()
  instrumentNavigation(router)

  createRoot(rootElement).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </StrictMode>,
  )
}

bootstrap().catch((err) => {
  console.error('[Aegis] Bootstrap failed:', err)
  const root = document.getElementById('root')
  if (root) root.textContent = `Failed to start: ${err.message}`
})
