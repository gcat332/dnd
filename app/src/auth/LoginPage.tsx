import { supabase } from '../lib/supabaseClient'

export function LoginPage() {
  function handleSignIn() {
    void supabase.auth.signInWithOAuth({
      provider: 'discord',
      options: { redirectTo: `${window.location.origin}/campaigns` },
    })
  }

  return (
    <main className="login-page">
      <h1>Taleforge</h1>
      <button type="button" onClick={handleSignIn}>
        Sign in with Discord
      </button>
    </main>
  )
}
