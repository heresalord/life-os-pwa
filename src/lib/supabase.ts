import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'

const supabaseUrl     = import.meta.env.VITE_SUPABASE_URL     as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('[supabase] Missing credentials in .env.local')
}

/**
 * Fully-typed Supabase client.
 *
 * The Database generic is generated from the live Supabase schema via:
 *   npm run types:supabase
 *
 * All table operations (insert, update, select, delete) are type-checked
 * against src/types/database.ts. If a column is missing from that file,
 * run the generation script to regenerate it from the live schema.
 *
 * There is intentionally no `as any` escape hatch exported from this file.
 * The only remaining internal cast is in sync.ts where dynamic table names
 * are required — that will be resolved in Phase 3 (sync engine simplification).
 */
export const supabase = createClient<Database>(
  supabaseUrl     || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder'
)
