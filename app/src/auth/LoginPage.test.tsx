import { cleanup, fireEvent, render, screen } from '@testing-library/react'
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
    render(<LoginPage />)

    fireEvent.click(screen.getByRole('button', { name: /sign in with discord/i }))

    expect(supabase.auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'discord',
      options: { redirectTo: expect.stringContaining('/campaigns') },
    })
  })

  it('displays error message when signInWithOAuth fails', async () => {
    const { supabase } = await import('../lib/supabaseClient')
    const error = new Error('Discord connection failed')
    vi.mocked(supabase.auth.signInWithOAuth).mockResolvedValueOnce({
      data: { provider: 'discord', url: null },
      error: { message: 'Discord connection failed', name: 'AuthError', status: 500 } as never,
    })
    render(<LoginPage />)

    fireEvent.click(screen.getByRole('button', { name: /sign in with discord/i }))

    expect(await screen.findByText('Discord connection failed')).toBeInTheDocument()
  })
})
