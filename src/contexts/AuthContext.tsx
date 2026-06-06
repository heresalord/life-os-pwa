import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
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
    // ── 1. Serve from Dexie immediately (instant) ─────────────────────────
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

    // ── 2. No cached profile (first login / new device) ──────────────────
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
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchProfile(session.user.id)
      } else {
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchProfile(session.user.id)
      } else {
        setProfile(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [fetchProfile])

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
