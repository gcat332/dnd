import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export function LoginPage() {
  const [error, setError] = useState<string | null>(null)

  async function handleSignIn() {
    const { error: signInError } = await supabase.auth.signInWithOAuth({
      provider: 'discord',
      options: { redirectTo: `${window.location.origin}/campaigns` },
    })
    if (signInError) {
      setError(signInError.message)
    }
  }

  return (
    <main className="login-page">
      <h1>Taleforge</h1>
      <button type="button" onClick={handleSignIn}>
        Sign in with Discord
      </button>
      {error && <div className="error-message">{error}</div>}
    </main>
  )
}
