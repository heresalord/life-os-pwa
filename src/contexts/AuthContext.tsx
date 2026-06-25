import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { Capacitor } from '@capacitor/core'
import { App as CapacitorApp } from '@capacitor/app'
import { supabase } from '../lib/supabase'
import { db } from '../db'
import { queryClient } from '../lib/queryClient'
import type { User, Session } from '@supabase/supabase-js'
import type { UserProfile } from '../db/schema'

// localStorage key that tracks which user's data is currently in Dexie.
// Used to detect account switching so we can wipe stale data before loading.
const LAST_USER_KEY = 'lifeos-last-user-id'

/**
 * Wipes ALL local state for the previous user:
 *   1. Deletes the entire Dexie/IndexedDB database (Dexie auto-recreates it
 *      empty on the next query — no manual reopen needed).
 *   2. Clears the React Query in-memory cache (24-hour gcTime means it would
 *      otherwise serve the previous user's data for up to 24 hours).
 *
 * Intentionally does NOT clear localStorage keys that belong to the device
 * rather than the user (theme, nav layout, locale, accent color).
 */
async function wipeLocalUserData() {
  try {
    queryClient.clear()
    await db.delete()
  } catch (err) {
    console.error('[AuthContext] wipeLocalUserData error:', err)
  }
}

interface AuthContextValue {
  session:        Session | null
  user:           User | null
  profile:        UserProfile | null
  loading:        boolean
  signOut:        () => Promise<void>
  refreshProfile: () => Promise<UserProfile | null>
}

const AuthContext = createContext<AuthContextValue>({
  session:        null,
  user:           null,
  profile:        null,
  loading:        true,
  signOut:        async () => {},
  refreshProfile: () => Promise.resolve(null),
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser]       = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchProfile = useCallback(async (userId: string, retries = 5) => {
    try {
      // ── Guard: detect account switch ─────────────────────────────────────
      // If a different user's data is sitting in Dexie, wipe it before we
      // read anything. This covers the "logged out → logged in as someone
      // else without refreshing the page" scenario.
      const lastUserId = localStorage.getItem(LAST_USER_KEY)
      if (lastUserId && lastUserId !== userId) {
        await wipeLocalUserData()
      }
      localStorage.setItem(LAST_USER_KEY, userId)

      // ── 1. Serve from Dexie immediately (instant) ─────────────────────
      const cached = await db.user_profiles.get(userId)
      if (cached) {
        setProfile(cached)
        setLoading(false)
        void supabase.from('user_profiles').select('*').eq('id', userId).maybeSingle()
          .then(({ data }) => {
            if (data) {
              setProfile(data as UserProfile)
              db.user_profiles.put(data as UserProfile)
            }
          })
        return cached
      }

      // ── 2. No cached profile — fetch from Supabase with back-off ──────
      for (let i = 0; i < retries; i++) {
        const { data, error } = await supabase
          .from('user_profiles').select('*').eq('id', userId).maybeSingle()
        if (data) {
          setProfile(data as UserProfile)
          setLoading(false)
          await db.user_profiles.put(data as UserProfile)
          return data as UserProfile
        }
        const isNotFound = !error || error.code === 'PGRST116'
        if (!isNotFound) break
        await new Promise(r => setTimeout(r, 400 * (i + 1)))
      }
      setLoading(false)
      return null
    } catch (err) {
      console.error('[AuthContext] fetchProfile error:', err)
      setLoading(false)
      return null
    }
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        const userId = session.user.id
        setTimeout(() => fetchProfile(userId), 0)
      } else {
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        if (event === 'SIGNED_IN') setLoading(true)
        const userId = session.user.id
        setTimeout(() => fetchProfile(userId), 0)
      } else {
        // SIGNED_OUT — clear the stored user marker so the next login
        // always triggers a fresh wipe regardless of which account it is.
        localStorage.removeItem(LAST_USER_KEY)
        setProfile(null)
        setLoading(false)
      }
    })

    const safetyTimer = setTimeout(() => setLoading(false), 8_000)
    return () => { subscription.unsubscribe(); clearTimeout(safetyTimer) }
  }, [fetchProfile])

  // ── Capacitor background/foreground session management ────────────────────
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    const listenerPromise = CapacitorApp.addListener('appStateChange', ({ isActive }: { isActive: boolean }) => {
      if (isActive) {
        supabase.auth.startAutoRefresh()
        supabase.auth.refreshSession().catch(() => {})
      } else {
        supabase.auth.stopAutoRefresh()
      }
    })
    return () => { listenerPromise.then((l: { remove: () => void }) => l.remove()) }
  }, [])

  const refreshProfile = useCallback(() => {
    if (user) return fetchProfile(user.id, 1)
    return Promise.resolve(null)
  }, [user, fetchProfile])

  /**
   * signOut — wipes ALL local state before signing out of Supabase.
   *
   * Order matters:
   *   1. Wipe Dexie + React Query first (while we still have a valid session
   *      so any in-flight mutations can be cancelled cleanly).
   *   2. Then call supabase.auth.signOut() which triggers SIGNED_OUT via
   *      onAuthStateChange, which clears profile/session state above.
   */
  const signOut = async () => {
    await wipeLocalUserData()
    localStorage.removeItem(LAST_USER_KEY)
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ session, user, profile, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
