import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi, afterEach } from 'vitest'
import { LoginPage } from './LoginPage'

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    auth: {
      signInWithOAuth: vi.fn().mockResolvedValue({ data: {}, error: null }),
    },
  },
}))

afterEach(() => {
  cleanup()
})

describe('LoginPage', () => {
  it('calls signInWithOAuth with the discord provider on click', async () => {
    const { supabase } = await import('../lib/supabaseClient')
    render(
      <MemoryRouter initialEntries={['/login']}>
        <LoginPage />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: /sign in with discord/i }))

    expect(supabase.auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'discord',
      options: { redirectTo: expect.stringContaining('/campaigns') },
    })
  })

  it('falls back to /campaigns when there is no "from" location state', async () => {
    const { supabase } = await import('../lib/supabaseClient')
    render(
      <MemoryRouter initialEntries={[{ pathname: '/login' }]}>
        <LoginPage />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: /sign in with discord/i }))

    expect(supabase.auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'discord',
      options: { redirectTo: `${window.location.origin}/campaigns` },
    })
  })

  it('redirects to the originally requested path when "from" state is present', async () => {
    const { supabase } = await import('../lib/supabaseClient')
    render(
      <MemoryRouter initialEntries={[{ pathname: '/login', state: { from: '/join/ABCD1234' } }]}>
        <LoginPage />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: /sign in with discord/i }))

    expect(supabase.auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'discord',
      options: { redirectTo: expect.stringContaining('/join/ABCD1234') },
    })
  })

  it('displays error message when signInWithOAuth fails', async () => {
    const { supabase } = await import('../lib/supabaseClient')
    const error = new Error('Discord connection failed')
    vi.mocked(supabase.auth.signInWithOAuth).mockResolvedValueOnce({
      data: { provider: 'discord', url: null },
      error: { message: 'Discord connection failed', name: 'AuthError', status: 500 } as never,
    })
    render(
      <MemoryRouter initialEntries={['/login']}>
        <LoginPage />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: /sign in with discord/i }))

    expect(await screen.findByText('Discord connection failed')).toBeInTheDocument()
  })
})
