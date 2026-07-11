import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useAuthSession } from './useAuthSession'

vi.mock('../lib/supabaseClient', () => {
  const listeners: Array<(event: string, session: unknown) => void> = []
  return {
    supabase: {
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
        onAuthStateChange: vi.fn((callback: (event: string, session: unknown) => void) => {
          listeners.push(callback)
          return { data: { subscription: { unsubscribe: vi.fn() } } }
        }),
      },
      __emit: (event: string, session: unknown) => listeners.forEach((cb) => cb(event, session)),
    },
  }
})

describe('useAuthSession', () => {
  it('starts loading, then resolves to a null session when signed out', async () => {
    const { result } = renderHook(() => useAuthSession())

    expect(result.current.loading).toBe(true)

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.session).toBeNull()
  })

  it('updates when an auth state change event fires', async () => {
    const { supabase } = await import('../lib/supabaseClient')
    const { result } = renderHook(() => useAuthSession())

    await waitFor(() => expect(result.current.loading).toBe(false))

    const fakeSession = { user: { id: 'user-1' } }
    act(() => {
      ;(supabase as unknown as { __emit: (e: string, s: unknown) => void }).__emit(
        'SIGNED_IN',
        fakeSession,
      )
    })

    expect(result.current.session).toEqual(fakeSession)
  })

  it('sets session to null and loading to false when getSession rejects', async () => {
    const { supabase } = await import('../lib/supabaseClient')
    vi.mocked(supabase.auth.getSession).mockRejectedValueOnce(new Error('Network error'))

    const { result } = renderHook(() => useAuthSession())

    expect(result.current.loading).toBe(true)

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.session).toBeNull()
  })
})
