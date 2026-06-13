import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { Capacitor } from '@capacitor/core'
import { App as CapacitorApp } from '@capacitor/app'
import { supabase } from '../lib/supabase'
import { db } from '../db'
import type { User, Session } from '@supabase/supabase-js'
import type { UserProfile } from '../db/schema'

interface AuthContextValue {
  session: Session | null
  user: User | null
  profile: UserProfile | null
  loading: boolean
  signOut: () => void
  refreshProfile: () => Promise<UserProfile | null>
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  user: null,
  profile: null,
  loading: true,
  signOut: () => {},
  refreshProfile: () => Promise.resolve(null),
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser]       = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchProfile = useCallback(async (userId: string, retries = 5) => {
    try {
      // ── 1. Serve from Dexie immediately (instant) ───────────────────────
      const cached = await db.user_profiles.get(userId)
      if (cached) {
        setProfile(cached)
        setLoading(false)
        // Background re-sync so changes (avatar, display name) propagate
        void supabase.from('user_profiles').select('*').eq('id', userId).maybeSingle()
          .then(({ data }) => {
            if (data) {
              setProfile(data as UserProfile)
              db.user_profiles.put(data as UserProfile)
            }
          })
        return cached
      }

      // ── 2. No cached profile (first login / new device) ────────────────
      // New signups: the DB trigger that creates user_profiles runs async.
      // Retry with back-off before giving up.
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
        // Exponential back-off: 400 ms, 800 ms, 1 200 ms …
        await new Promise(r => setTimeout(r, 400 * (i + 1)))
      }
      setLoading(false)
      return null
    } catch (err) {
      // Catch Dexie/IndexedDB errors (common in Capacitor WebViews) so the
      // loading spinner never gets permanently stuck.
      console.error('[AuthContext] fetchProfile error:', err)
      setLoading(false)
      return null
    }
  }, [])

  useEffect(() => {
    // ── Primary bootstrap: check for an existing session immediately.
    // This is what clears the loading spinner on page reload / app start.
    // We can't rely solely on onAuthStateChange(INITIAL_SESSION) because in
    // Capacitor WebViews (and some browsers) that event fires with a noticeable
    // delay, leaving loading=true and the screen blank in the meantime.
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        // Defer the profile fetch to the next event-loop tick.
        // Calling supabase.from() synchronously inside the auth resolution
        // path can contend with Supabase's internal async lock and hang.
        const userId = session.user.id
        setTimeout(() => fetchProfile(userId), 0)
      } else {
        setLoading(false)
      }
    })

    // ── Subsequent auth changes: login, logout, token refresh.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        // Re-arm the loading gate on actual sign-in so AuthGuard keeps showing
        // its spinner while the profile fetches — prevents a false redirect to
        // /onboarding before the profile arrives.
        // INITIAL_SESSION is already handled by getSession() above.
        if (event === 'SIGNED_IN') {
          setLoading(true)
        }
        const userId = session.user.id
        setTimeout(() => fetchProfile(userId), 0)
      } else {
        setProfile(null)
        setLoading(false)
      }
    })

    // ── Safety net: guarantee loading clears even if both paths above fail
    // (e.g. network down on first load, Supabase misconfiguration, etc.).
    const safetyTimer = setTimeout(() => setLoading(false), 8_000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(safetyTimer)
    }
  }, [fetchProfile])

  // ── Capacitor lifecycle: keep the auth session alive across long
  // backgrounding periods (e.g. the APK being closed for hours).
  //
  // supabase-js's `autoRefreshToken` relies on a setInterval ticker, which
  // Android suspends/throttles once the WebView is backgrounded. If a
  // refresh happens to fire mid-suspend (e.g. during a brief Doze window)
  // it can rotate the refresh token without the new one being durably
  // persisted, leaving the stored session unusable on resume — which then
  // surfaces as a hard sign-out next time a request gets a 401.
  //
  // Fix (per Supabase's recommended pattern for mobile/native clients):
  // stop the ticker while backgrounded, and on resume, restart it and
  // immediately re-validate/refresh the session.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return

    const listenerPromise = CapacitorApp.addListener('appStateChange', ({ isActive }: { isActive: boolean }) => {
      if (isActive) {
        supabase.auth.startAutoRefresh()
        // Force a session check now — if the access token expired while
        // backgrounded, this refreshes it (or surfaces a real SIGNED_OUT
        // via onAuthStateChange if the refresh token is genuinely invalid).
        supabase.auth.getSession()
      } else {
        supabase.auth.stopAutoRefresh()
      }
    })

    return () => {
      listenerPromise.then((l: { remove: () => void }) => l.remove())
    }
  }, [])

  const refreshProfile = useCallback(() => {
    if (user) return fetchProfile(user.id, 1)
    return Promise.resolve(null)
  }, [user, fetchProfile])

  const signOut = () => supabase.auth.signOut()

  return (
    <AuthContext.Provider value={{ session, user, profile, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

/** Drop-in replacement for the old useAuth hook — reads from the shared context. */
export function useAuth() {
  return useContext(AuthContext)
}
