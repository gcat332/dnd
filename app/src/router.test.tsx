import { render, screen } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { routeConfig } from './router'

vi.mock('./lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { user: { id: 'user-1' } } },
      }),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
  },
}))

async function setAuthSession(session: unknown) {
  const { supabase } = await import('./lib/supabaseClient')
  vi.mocked(supabase.auth.getSession).mockResolvedValueOnce({
    data: { session },
  } as never)
}

describe('routeConfig', () => {
  it('renders the login route at /login', async () => {
    const router = createMemoryRouter(routeConfig, { initialEntries: ['/login'] })
    render(<RouterProvider router={router} />)

    expect(await screen.findByText(/sign in with discord/i)).toBeInTheDocument()
  })

  it('renders the campaign list route at /campaigns when signed in', async () => {
    const router = createMemoryRouter(routeConfig, { initialEntries: ['/campaigns'] })
    render(<RouterProvider router={router} />)

    expect(await screen.findByText(/your campaigns/i)).toBeInTheDocument()
  })

  it('redirects to /login when accessing a protected route without authentication', async () => {
    await setAuthSession(null)
    const router = createMemoryRouter(routeConfig, { initialEntries: ['/campaigns'] })
    render(<RouterProvider router={router} />)

    expect(await screen.findByText(/sign in with discord/i)).toBeInTheDocument()
  })
})
