import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined

const missing = [
  !url && 'VITE_SUPABASE_URL',
  !key && 'VITE_SUPABASE_PUBLISHABLE_KEY',
].filter(Boolean)

/**
 * Human-readable reason the client could not be created, or null when it was.
 * Shown on screen instead of throwing at import time.
 */
export const supabaseConfigError: string | null = missing.length
  ? `Missing ${missing.join(' and ')}. Copy web/.env.example to web/.env.local, fill in the Supabase URL and publishable key, then restart the dev server.`
  : null

/**
 * Browser client using the publishable key. It is read-only under row-level
 * security, and this site never signs anyone in, so sessions are not stored.
 */
export const supabase: SupabaseClient | null =
  url && key
    ? createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null
