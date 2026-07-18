import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { Capacitor } from '@capacitor/core'
import { App as CapacitorApp } from '@capacitor/app'
import { supabase } from '../lib/supabase'
import type { User, Session } from '@supabase/supabase-js'
import type { UserProfile } from '../db/schema'

/**
 * AuthContext
 *
 * Responsibilities:
 *   - Manage Supabase session and user state
 *   - Fetch and cache the user profile from Supabase
 *   - Handle token refresh on Capacitor foreground events
 *
 * What this does NOT do:
 *   - Touch Dexie / IndexedDB directly. That is DbProvider's responsibility.
 *     DbProvider creates a user-scoped LifeOSDB_${userId} database once auth
 *     resolves, which physically isolates each user's data.
 *   - Clear React Query cache on signout. DbProvider unmounts on signout,
 *     which disposes the Dexie instance. A fresh DbProvider mounts on the next
 *     login with a new user-scoped DB — stale data never crosses users.
 *
 * Profile bootstrap sequence:
 *   1. getSession() returns the cached Supabase token (synchronous).
 *   2. fetchProfile(userId) calls Supabase with up to 5 retries.
 *   3. AuthGuard renders → mounts DbProvider(userId).
 *   4. DbProvider opens LifeOSDB_${userId}, runs legacy migration if needed,
 *      and starts the sync engine.
 *   5. All subsequent data reads use useDb() from DbContext — no Dexie access here.
 */

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
  const [user,    setUser]    = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  /**
   * Fetch the user profile from Supabase with exponential back-off.
   *
   * We intentionally do NOT read from Dexie here. The first Supabase
   * response typically takes < 200 ms on a good connection, and reading
   * from Dexie would require opening a parallel LifeOSDatabase instance
   * before DbProvider has had a chance to open its own instance — leading
   * to multiple unclosed handles on the same IndexedDB database.
   *
   * Offline resilience is provided by the 8-second safety timer below,
   * which unblocks the UI even if Supabase never responds.
   */
  const fetchProfile = useCallback(async (userId: string, retries = 5): Promise<UserProfile | null> => {
    for (let i = 0; i < retries; i++) {
      try {
        const { data, error } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle()

        if (data) {
          setProfile(data as UserProfile)
          setLoading(false)
          return data as UserProfile
        }

        // PGRST116 = row not found — profile hasn't been created yet.
        // Retry with back-off so the onboarding trigger has time to run.
        const isNotFound = !error || error.code === 'PGRST116'
        if (!isNotFound) {
          console.warn('[AuthContext] fetchProfile error:', error)
          break
        }
      } catch (err) {
        console.warn('[AuthContext] fetchProfile fetch failed:', err)
        break
      }

      // Exponential back-off: 400 ms, 800 ms, 1200 ms, 1600 ms, 2000 ms
      await new Promise(r => setTimeout(r, 400 * (i + 1)))
    }

    setLoading(false)
    return null
  }, [])

  // ── Bootstrap: read the current session on mount ──────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        void fetchProfile(session.user.id)
      } else {
        setLoading(false)
      }
    })

    // React to auth state changes (sign in, sign out, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session)
      setUser(session?.user ?? null)

      if (session?.user) {
        if (event === 'SIGNED_IN') setLoading(true)
        void fetchProfile(session.user.id)
      } else {
        // SIGNED_OUT — clear profile state.
        // DbProvider will unmount automatically (it's inside AuthGuard which
        // checks `user`), closing its LifeOSDB_${userId} Dexie instance.
        // The next login opens a fresh scoped database for the new user.
        setProfile(null)
        setLoading(false)
      }
    })

    // Safety timer: if Supabase never responds (e.g., truly offline with no
    // cached session), unblock the UI after 8 s so the user sees the sign-in
    // screen rather than an infinite spinner.
    const safetyTimer = setTimeout(() => setLoading(false), 8_000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(safetyTimer)
    }
  }, [fetchProfile])

  // ── Capacitor: manage token refresh on background/foreground ─────────────
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return

    const listenerPromise = CapacitorApp.addListener(
      'appStateChange',
      ({ isActive }: { isActive: boolean }) => {
        if (isActive) {
          // Force a token refresh immediately on foreground so the session
          // never silently expires while the app is backgrounded.
          supabase.auth.startAutoRefresh()
          supabase.auth.refreshSession().catch(() => {
            // Ignore — onAuthStateChange fires SIGNED_OUT if genuinely invalid
          })
        } else {
          supabase.auth.stopAutoRefresh()
        }
      }
    )

    return () => {
      listenerPromise.then((l: { remove: () => void }) => l.remove())
    }
  }, [])

  const refreshProfile = useCallback((): Promise<UserProfile | null> => {
    if (user) return fetchProfile(user.id, 1)
    return Promise.resolve(null)
  }, [user, fetchProfile])

  /**
   * signOut
   *
   * Calls supabase.auth.signOut() which fires a SIGNED_OUT event via
   * onAuthStateChange. That handler clears the profile state above.
   * AuthGuard detects `user === null` and redirects to /signin.
   * DbProvider unmounts as part of that redirect, closing the Dexie instance.
   * No manual data wipe is needed — data isolation is structural (user-scoped DB).
   */
  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  return (
    <AuthContext.Provider value={{ session, user, profile, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
