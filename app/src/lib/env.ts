export type TaleforgeEnv = {
  supabaseUrl: string
  supabaseAnonKey: string
}

type EnvSource = Record<string, string | undefined>

function requireVar(source: EnvSource, key: string): string {
  const value = source[key]
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`)
  }
  return value
}

export function getEnv(source: EnvSource = import.meta.env as EnvSource): TaleforgeEnv {
  return {
    supabaseUrl: requireVar(source, 'VITE_SUPABASE_URL'),
    supabaseAnonKey: requireVar(source, 'VITE_SUPABASE_ANON_KEY'),
  }
}
