import { describe, expect, it } from 'vitest'
import { getEnv } from './env'

describe('getEnv', () => {
  it('reads supabase URL and anon key from the provided source', () => {
    const env = getEnv({
      VITE_SUPABASE_URL: 'https://example.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'anon-key-value',
    })

    expect(env).toEqual({
      supabaseUrl: 'https://example.supabase.co',
      supabaseAnonKey: 'anon-key-value',
    })
  })

  it('throws a clear error when a required variable is missing', () => {
    expect(() => getEnv({ VITE_SUPABASE_URL: 'https://example.supabase.co' })).toThrow(
      'Missing required environment variable: VITE_SUPABASE_ANON_KEY',
    )
  })
})
