import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRootRoute, createRoute, createRouter, RouterProvider } from '@tanstack/react-router'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Header } from '@/components/shared/Header'

describe('App', () => {
  it('renders the Aegis header text', () => {
    render(<Header />)
    expect(screen.getByText('Aegis')).toBeInTheDocument()
  })

  it('renders without crashing with router and query provider', async () => {
    const rootRoute = createRootRoute({
      component: () => <div>Aegis</div>,
    })

    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      component: () => <div>Home</div>,
    })

    const routeTree = rootRoute.addChildren([indexRoute])
    const router = createRouter({ routeTree })
    const queryClient = new QueryClient()

    render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    )

    expect(await screen.findByText('Aegis')).toBeInTheDocument()
  })
})
