import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { User, Session } from '@supabase/supabase-js'
import type { UserProfile } from '../db/schema'

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchProfile = useCallback(async (userId: string, retries = 5) => {
    // New signups: the DB trigger that creates user_profiles runs async.
    // Retry up to `retries` times with increasing delay before giving up.
    for (let i = 0; i < retries; i++) {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle()

      if (data) {
        setProfile(data as UserProfile)
        setLoading(false)
        return data
      }

      // PGRST116 = row not found yet — wait and retry
      const isNotFound = !error || error.code === 'PGRST116'
      if (!isNotFound) break

      // Exponential back-off: 400ms, 800ms, 1200ms, 1600ms, 2000ms
      await new Promise(r => setTimeout(r, 400 * (i + 1)))
    }

    // Gave up — user has no profile yet (very new signup, trigger slow)
    // Leave profile as null; AuthGuard will send them to /onboarding
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
    if (user) return fetchProfile(user.id, 1) // single attempt — profile exists by now
    return Promise.resolve(null)
  }, [user, fetchProfile])

  const signOut = () => supabase.auth.signOut()

  return { session, user, profile, loading, signOut, refreshProfile }
}
