import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { routeConfig } from './router'

vi.mock('./lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { user: { id: 'user-1' } } },
      }),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      signInWithOAuth: vi.fn().mockResolvedValue({ data: {}, error: null }),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
    })),
  },
}))

async function setAuthSession(session: unknown) {
  const { supabase } = await import('./lib/supabaseClient')
  vi.mocked(supabase.auth.getSession).mockResolvedValueOnce({
    data: { session },
  } as never)
}

afterEach(() => {
  cleanup()
})

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

  it('preserves the originally requested /join/:code path through the login redirect', async () => {
    await setAuthSession(null)
    const { supabase } = await import('./lib/supabaseClient')
    const router = createMemoryRouter(routeConfig, { initialEntries: ['/join/ABCD1234'] })
    render(<RouterProvider router={router} />)

    expect(await screen.findByText(/sign in with discord/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /sign in with discord/i }))

    await waitFor(() => {
      expect(supabase.auth.signInWithOAuth).toHaveBeenCalledWith({
        provider: 'discord',
        options: { redirectTo: expect.stringContaining('/join/ABCD1234') },
      })
    })
  })
})
