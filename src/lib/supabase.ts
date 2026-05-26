import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Missing Supabase credentials in .env.local')
}

// Typed client for RLS and auth
export const supabase = createClient<Database>(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder'
)

// Escape hatch for insert/update calls where the generic resolution
// produces 'never' due to TS inference limits with complex union types.
// All runtime behaviour is identical — types are enforced by our API layer.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const db = supabase as any
