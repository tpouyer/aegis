import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRouter, RouterProvider } from '@tanstack/react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { authManager } from './lib/auth/manager'
import { CacheStore } from './lib/cache/indexeddb'
import { initTelemetry } from './lib/telemetry/init'
import { instrumentNavigation } from './lib/telemetry/instruments/navigation'
import { routeTree } from './routeTree.gen'
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

const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

const rootElement = document.getElementById('root')!

async function bootstrap() {
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
