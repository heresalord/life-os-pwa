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
 *
 * Offline resilience (A1):
 *   - profileStatus distinguishes between "server confirmed no row" (missing)
 *     and "network failed, don't know" (unknown).
 *   - On `unknown`, AuthGuard uses the cached profile from localStorage so the
 *     user lands on Today with data instead of being redirected to onboarding.
 *   - We never call signOut or clear state on a network error. Only an explicit
 *     SIGNED_OUT event or a genuinely auth-rejected refresh does that.
 */

/** Prefix for all localStorage keys — stable even if the app is renamed. */
const LS_PREFIX = 'kairo'

function profileCacheKey(userId: string) {
  return `${LS_PREFIX}:profile:${userId}`
}

const LAST_USER_KEY = `${LS_PREFIX}:lastUserId`

function readCachedProfile(userId: string): UserProfile | null {
  try {
    const raw = localStorage.getItem(profileCacheKey(userId))
    return raw ? (JSON.parse(raw) as UserProfile) : null
  } catch {
    return null
  }
}

function writeCachedProfile(profile: UserProfile) {
  try {
    localStorage.setItem(profileCacheKey(profile.id), JSON.stringify(profile))
    localStorage.setItem(LAST_USER_KEY, profile.id)
  } catch {
    // Storage full or private-mode restriction — not fatal
  }
}

/**
 * profileStatus:
 *   'loading'  — waiting for the first server response
 *   'ready'    — server confirmed a profile row exists
 *   'missing'  — server answered and there is no row → redirect to onboarding
 *   'unknown'  — network failure; may have a cached profile
 */
export type ProfileStatus = 'loading' | 'ready' | 'missing' | 'unknown'

interface AuthContextValue {
  session:        Session | null
  user:           User | null
  profile:        UserProfile | null
  profileStatus:  ProfileStatus
  /** @deprecated Use profileStatus instead of loading for routing decisions */
  loading:        boolean
  signOut:        () => Promise<void>
  refreshProfile: () => Promise<UserProfile | null>
}

const AuthContext = createContext<AuthContextValue>({
  session:        null,
  user:           null,
  profile:        null,
  profileStatus:  'loading',
  loading:        true,
  signOut:        async () => {},
  refreshProfile: () => Promise.resolve(null),
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user,    setUser]    = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [profileStatus, setProfileStatus] = useState<ProfileStatus>('loading')

  // loading is derived so existing consumers that check it still work
  const loading = profileStatus === 'loading'

  /**
   * Fetch the user profile from Supabase with exponential back-off.
   *
   * On success: writes to state + localStorage cache, status → 'ready'.
   * On "row not found" after all retries: status → 'missing' (go to onboarding).
   * On network/unexpected error: status → 'unknown'; AuthGuard uses cached profile.
   *
   * We intentionally do NOT read from Dexie here. The first Supabase
   * response typically takes < 200 ms on a good connection, and reading
   * from Dexie would require opening a parallel LifeOSDatabase instance
   * before DbProvider has had a chance to open its own instance — leading
   * to multiple unclosed handles on the same IndexedDB database.
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
          const profileData = data as UserProfile
          setProfile(profileData)
          setProfileStatus('ready')
          writeCachedProfile(profileData)
          return profileData
        }

        // PGRST116 = row not found — profile hasn't been created yet.
        // Retry with back-off so the onboarding trigger has time to run.
        const isNotFound = !error || error.code === 'PGRST116'
        if (!isNotFound) {
          // Supabase returned a real error (not just "no row"). Treat as unknown
          // so we don't falsely redirect to onboarding.
          console.warn('[AuthContext] fetchProfile API error:', error)
          const cached = readCachedProfile(userId)
          if (cached) setProfile(cached)
          setProfileStatus('unknown')
          return cached
        }
      } catch (err) {
        // Network failure (fetch threw) — distinguish from API errors below
        console.warn('[AuthContext] fetchProfile network error:', err)
        const cached = readCachedProfile(userId)
        if (cached) {
          setProfile(cached)
        }
        setProfileStatus('unknown')
        return cached
      }

      // Exponential back-off: 400 ms, 800 ms, 1200 ms, 1600 ms, 2000 ms
      await new Promise(r => setTimeout(r, 400 * (i + 1)))
    }

    // All retries exhausted and every response said "no row" → genuinely missing
    setProfileStatus('missing')
    return null
  }, [])

  // ── Bootstrap: read the current session on mount ──────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        // Immediately show cached profile so AuthGuard doesn't flash the spinner
        // for users who are offline but have cached data.
        const cached = readCachedProfile(session.user.id)
        if (cached) {
          setProfile(cached)
          // Keep status 'loading' so we still attempt a server fetch,
          // but AuthGuard can unblock with the cached value while we wait.
        }
        void fetchProfile(session.user.id)
      } else {
        setProfileStatus('missing')
      }
    })

    // React to auth state changes (sign in, sign out, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session)
      setUser(session?.user ?? null)

      if (session?.user) {
        if (event === 'SIGNED_IN') setProfileStatus('loading')
        void fetchProfile(session.user.id)
      } else if (event === 'SIGNED_OUT') {
        // Only SIGNED_OUT (explicit or auth-rejected) clears profile state.
        // A network error will NOT reach here, so we never falsely log the user out.
        setProfile(null)
        setProfileStatus('missing')
      }
      // TOKEN_REFRESHED, USER_UPDATED, etc. — do nothing extra.
    })

    // Safety timer: if Supabase never responds (e.g., truly offline with no
    // cached session), unblock the UI after 8 s.
    // If we already have a cached profile, we don't need to wait.
    const safetyTimer = setTimeout(() => {
      setProfileStatus(prev => {
        if (prev === 'loading') {
          // We timed out waiting — treat as unknown so AuthGuard
          // uses the cached profile if one exists.
          return 'unknown'
        }
        return prev
      })
    }, 8_000)

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
            // Network failure during refresh — do NOT sign out.
            // onAuthStateChange only fires SIGNED_OUT if the server explicitly
            // rejects the refresh token (401/403). A network timeout is silent.
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
    <AuthContext.Provider value={{ session, user, profile, profileStatus, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
