import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useAppStore } from '../../store/useAppStore'
import { userSettingsApi } from '../../api/userSettings'
import { userProfilesApi } from '../../api/userProfiles'
import { db } from '../../db'
import type { UserProfile } from '../../db/schema'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { supabase as supa } from '../../lib/supabase'
const sbAny = supa as any

export function OnboardingFlow() {
  const { user, profile, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const { setTimezone: setStoreTimezone, setTheme } = useAppStore()

  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [name, setName] = useState('')
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone)
  const [currency, setCurrency] = useState('USD')
  const [morningTime, setMorningTime] = useState('07:00')
  const [nightTime, setNightTime] = useState('21:00')

  useEffect(() => {
    if (profile?.display_name && !name) setName(profile.display_name)
  }, [profile]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleComplete = async () => {
    if (!user) return
    setLoading(true)
    setError('')
    try {
      // 1. Create/upsert user_settings
      await userSettingsApi.upsert({
        user_id: user.id,
        currency,
        morning_reminder_time: morningTime,
        night_reminder_time: nightTime,
        notifications_enabled: false,
        theme: 'light',
      })

      // 2. Update profile — if the trigger hasn't created it yet, insert it
      try {
        await userProfilesApi.update(user.id, {
          display_name: name.trim(),
          timezone,
          onboarded: true,
        })
      } catch {
        // Profile row may not exist yet if trigger was slow — insert it
        await sbAny.from('user_profiles').upsert({
          id: user.id,
          display_name: name.trim(),
          timezone,
          onboarded: true,
        }, { onConflict: 'id' })
      }

      // 3. Write the updated profile straight into the Dexie cache so that
      //    refreshProfile() reads onboarded=true from cache immediately,
      //    instead of returning the stale cached row and doing a slow
      //    background re-sync that would send us back to /onboarding.
      const updatedProfile: UserProfile = {
        ...(profile ?? ({} as UserProfile)),
        id: user.id,
        display_name: name.trim(),
        timezone,
        onboarded: true,
      }
      await db.user_profiles.put(updatedProfile)

      // 4. Apply timezone + theme locally
      setStoreTimezone(timezone)
      setTheme('light')

      // 5. Refresh profile in auth state — now reads the correct cached row
      await refreshProfile()

      navigate('/', { replace: true })
    } catch (err) {
      console.error('Onboarding error:', err)
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) &&
    !(window as unknown as Record<string, unknown>).MSStream

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-surface border border-border rounded-2xl shadow-lg p-6 sm:p-8">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-display text-accent">Life OS</h1>
            <span className="text-text-muted text-sm">Step {step} of 5</span>
          </div>
          <div className="w-full bg-surface-2 rounded-full h-1.5 overflow-hidden">
            <div className="bg-accent h-full rounded-full transition-all duration-300" style={{ width: `${(step / 5) * 100}%` }} />
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-danger/10 border border-danger/30 rounded-xl text-sm text-danger">
            {error}
          </div>
        )}

        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg text-text font-medium mb-1">What should we call you?</h2>
              <p className="text-text-secondary text-sm mb-4">A friendly name for your dashboard.</p>
              <input type="text" value={name} onChange={e => setName(e.target.value)}
                placeholder="Your name" autoFocus
                className="selectable w-full bg-surface-2 border border-border rounded-xl px-4 py-3 text-text focus:border-accent focus:outline-none" />
            </div>
            <button onClick={() => name.trim() && setStep(2)} disabled={!name.trim()}
              className="w-full bg-accent text-bg font-medium rounded-xl py-3 hover:bg-accent-dim transition-colors disabled:opacity-50">
              Continue
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg text-text font-medium mb-1">Your timezone</h2>
              <p className="text-text-secondary text-sm mb-4">Used for daily task carry-overs and reminders.</p>
              <input type="text" value={timezone} onChange={e => setTimezone(e.target.value)}
                className="selectable w-full bg-surface-2 border border-border rounded-xl px-4 py-3 text-text focus:border-accent focus:outline-none" />
              <p className="text-text-muted text-xs mt-1.5">Auto-detected — edit if incorrect.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="flex-1 bg-surface-2 text-text font-medium rounded-xl py-3 hover:bg-muted transition-colors">Back</button>
              <button onClick={() => timezone.trim() && setStep(3)} disabled={!timezone.trim()}
                className="flex-[2] bg-accent text-bg font-medium rounded-xl py-3 hover:bg-accent-dim transition-colors disabled:opacity-50">Continue</button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg text-text font-medium mb-1">Currency selection</h2>
              <p className="text-text-secondary text-sm mb-4">Choose your primary currency for transactions and accounts.</p>
              <div>
                <label className="block text-xs text-text-muted mb-1 uppercase tracking-wider">Currency</label>
                <input type="text" value={currency} onChange={e => setCurrency(e.target.value.toUpperCase())} maxLength={3}
                  className="selectable w-full bg-surface-2 border border-border rounded-xl px-4 py-3 text-text focus:border-accent focus:outline-none text-center uppercase font-medium" />
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep(2)} className="flex-1 bg-surface-2 text-text font-medium rounded-xl py-3 hover:bg-muted transition-colors">Back</button>
              <button onClick={() => currency && setStep(4)} disabled={!currency}
                className="flex-[2] bg-accent text-bg font-medium rounded-xl py-3 hover:bg-accent-dim transition-colors disabled:opacity-50">Continue</button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg text-text font-medium mb-1">Morning Ritual</h2>
              <p className="text-text-secondary text-sm mb-4">When do you want a gentle reminder to start your day?</p>
              <input type="time" value={morningTime} onChange={e => setMorningTime(e.target.value)}
                className="selectable w-full bg-surface-2 border border-border rounded-xl px-4 py-3 text-text focus:border-accent focus:outline-none text-xl text-center" />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep(3)} className="flex-1 bg-surface-2 text-text font-medium rounded-xl py-3 hover:bg-muted transition-colors">Back</button>
              <button onClick={() => setStep(5)} className="flex-[2] bg-accent text-bg font-medium rounded-xl py-3 hover:bg-accent-dim transition-colors">Continue</button>
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg text-text font-medium mb-1">Evening Review</h2>
              <p className="text-text-secondary text-sm mb-4">When do you want a reminder to reflect on your day?</p>
              <input type="time" value={nightTime} onChange={e => setNightTime(e.target.value)}
                className="selectable w-full bg-surface-2 border border-border rounded-xl px-4 py-3 text-text focus:border-accent focus:outline-none text-xl text-center" />
            </div>

            {isIOS && (
              <div className="bg-info/10 border border-info/30 p-4 rounded-xl">
                <p className="text-info text-sm font-medium mb-1">Using iPhone or iPad?</p>
                <p className="text-info/80 text-xs leading-relaxed">
                  Tap <strong>Share →</strong> <strong>"Add to Home Screen"</strong> for the best experience and to enable push notifications.
                </p>
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => setStep(4)} className="flex-1 bg-surface-2 text-text font-medium rounded-xl py-3 hover:bg-muted transition-colors">Back</button>
              <button onClick={handleComplete} disabled={loading}
                className="flex-[2] bg-accent text-bg font-medium rounded-xl py-3 hover:bg-accent-dim transition-colors disabled:opacity-50">
                {loading ? 'Setting up…' : 'Start using Life OS'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
