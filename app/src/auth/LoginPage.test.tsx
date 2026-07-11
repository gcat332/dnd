import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { LoginPage } from './LoginPage'

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    auth: {
      signInWithOAuth: vi.fn().mockResolvedValue({ data: {}, error: null }),
    },
  },
}))

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
})
