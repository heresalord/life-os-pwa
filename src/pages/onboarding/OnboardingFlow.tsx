import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useAppStore } from '../../store/useAppStore'
import { userSettingsApi } from '../../api/userSettings'
import { userProfilesApi } from '../../api/userProfiles'

export function OnboardingFlow() {
  const { user, profile, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const setStoreTimezone = useAppStore(state => state.setTimezone)

  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)

  const [name, setName] = useState('')
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone)
  const [currency, setCurrency] = useState('USD')
  const [budget, setBudget] = useState('100')
  const [morningTime, setMorningTime] = useState('07:00')
  const [nightTime, setNightTime] = useState('21:00')

  useEffect(() => {
    if (profile?.display_name && !name) setName(profile.display_name)
  }, [profile])

  const handleComplete = async () => {
    if (!user) return
    setLoading(true)
    try {
      await userSettingsApi.upsert({
        user_id: user.id,
        currency,
        daily_budget: parseFloat(budget),
        morning_reminder_time: morningTime,
        night_reminder_time: nightTime,
        notifications_enabled: false,
      })
      await userProfilesApi.update(user.id, {
        display_name: name,
        timezone,
        onboarded: true,
      })
      setStoreTimezone(timezone)
      await refreshProfile()
      navigate('/')
    } finally {
      setLoading(false)
    }
  }

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as unknown as Record<string, unknown>).MSStream

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-surface border border-border rounded-xl shadow-lg p-6 sm:p-8">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-display text-accent">Setup Life OS</h1>
            <span className="text-text-muted text-sm">Step {step} of 5</span>
          </div>
          <div className="w-full bg-surface-2 rounded-full h-2">
            <div className="bg-accent h-2 rounded-full transition-all duration-300" style={{ width: `${(step / 5) * 100}%` }} />
          </div>
        </div>

        {step === 1 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
            <div>
              <h2 className="text-lg text-text font-medium mb-2">What should we call you?</h2>
              <p className="text-text-secondary text-sm mb-4">A friendly display name for your dashboard.</p>
              <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Your name" autoFocus
                className="w-full bg-surface-2 border border-border rounded-md px-4 py-3 text-text focus:border-accent focus:outline-none" />
            </div>
            <button onClick={() => name.trim() && setStep(2)} disabled={!name.trim()}
              className="w-full bg-accent text-bg font-medium rounded-md py-3 hover:bg-accent-dim disabled:opacity-50">Continue</button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
            <div>
              <h2 className="text-lg text-text font-medium mb-2">Set your timezone</h2>
              <p className="text-text-secondary text-sm mb-4">Crucial for accurate daily carry-overs and reminders.</p>
              <input type="text" value={timezone} onChange={e => setTimezone(e.target.value)}
                className="w-full bg-surface-2 border border-border rounded-md px-4 py-3 text-text focus:border-accent focus:outline-none" />
              <p className="text-text-muted text-xs mt-2">Auto-detected. Edit if incorrect.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="flex-1 bg-surface-2 text-text font-medium rounded-md py-3 hover:bg-muted">Back</button>
              <button onClick={() => timezone.trim() && setStep(3)} disabled={!timezone.trim()}
                className="flex-[2] bg-accent text-bg font-medium rounded-md py-3 hover:bg-accent-dim disabled:opacity-50">Continue</button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
            <div>
              <h2 className="text-lg text-text font-medium mb-2">Finance awareness</h2>
              <p className="text-text-secondary text-sm mb-4">Set your currency and a loose daily budget target.</p>
              <div className="flex gap-3 mb-4">
                <div className="w-1/3">
                  <label className="block text-xs text-text-muted mb-1">Currency</label>
                  <input type="text" value={currency} onChange={e => setCurrency(e.target.value.toUpperCase())} maxLength={3}
                    className="w-full bg-surface-2 border border-border rounded-md px-4 py-3 text-text focus:border-accent focus:outline-none text-center uppercase" />
                </div>
                <div className="flex-1">
                  <label className="block text-xs text-text-muted mb-1">Daily Budget</label>
                  <input type="number" value={budget} onChange={e => setBudget(e.target.value)} min="0"
                    className="w-full bg-surface-2 border border-border rounded-md px-4 py-3 text-text focus:border-accent focus:outline-none" />
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep(2)} className="flex-1 bg-surface-2 text-text font-medium rounded-md py-3 hover:bg-muted">Back</button>
              <button onClick={() => currency && budget && setStep(4)} disabled={!currency || !budget}
                className="flex-[2] bg-accent text-bg font-medium rounded-md py-3 hover:bg-accent-dim disabled:opacity-50">Continue</button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
            <div>
              <h2 className="text-lg text-text font-medium mb-2">Morning Ritual</h2>
              <p className="text-text-secondary text-sm mb-4">When do you usually start your day?</p>
              <input type="time" value={morningTime} onChange={e => setMorningTime(e.target.value)}
                className="w-full bg-surface-2 border border-border rounded-md px-4 py-3 text-text focus:border-accent focus:outline-none text-xl text-center" />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep(3)} className="flex-1 bg-surface-2 text-text font-medium rounded-md py-3 hover:bg-muted">Back</button>
              <button onClick={() => setStep(5)} className="flex-[2] bg-accent text-bg font-medium rounded-md py-3 hover:bg-accent-dim">Continue</button>
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
            <div>
              <h2 className="text-lg text-text font-medium mb-2">Evening Review</h2>
              <p className="text-text-secondary text-sm mb-4">When do you want to wind down and reflect?</p>
              <input type="time" value={nightTime} onChange={e => setNightTime(e.target.value)}
                className="w-full bg-surface-2 border border-border rounded-md px-4 py-3 text-text focus:border-accent focus:outline-none text-xl text-center" />
            </div>
            {isIOS && (
              <div className="bg-info/10 border border-info/30 p-4 rounded-md">
                <p className="text-info text-sm font-medium">Using an iPhone/iPad?</p>
                <p className="text-info/80 text-xs mt-1">Tap Share → <b>"Add to Home Screen"</b> for the best experience and push notifications.</p>
              </div>
            )}
            <div className="flex gap-3 mt-8">
              <button onClick={() => setStep(4)} className="flex-1 bg-surface-2 text-text font-medium rounded-md py-3 hover:bg-muted">Back</button>
              <button onClick={handleComplete} disabled={loading}
                className="flex-[2] bg-accent text-bg font-medium rounded-md py-3 hover:bg-accent-dim disabled:opacity-50">
                {loading ? 'Finishing...' : 'Complete Setup'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
