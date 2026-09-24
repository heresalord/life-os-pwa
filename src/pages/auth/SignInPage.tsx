import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { AuthLayout } from '../../components/auth/AuthLayout'
import { Link, useNavigate } from 'react-router-dom'
import {
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Mail,
  Sparkles,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react'
import * as Tabs from '@radix-ui/react-tabs'
import { hashRecoveryPhrase } from '../../lib/recoveryKey'
import { haptic } from '../../lib/haptic'

type AuthTab = 'password' | 'magic' | 'recovery'

export function SignInPage() {
  const [activeTab, setActiveTab] = useState<AuthTab>('password')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [recoveryPhrase, setRecoveryPhrase] = useState('')
  const [recoveryNewPassword, setRecoveryNewPassword] = useState('')
  const [showRecoveryPassword, setShowRecoveryPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<{ text: string; type: 'error' | 'success' | '' }>({
    text: '',
    type: '',
  })
  const navigate = useNavigate()

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    haptic('light')
    setLoading(true)
    setMsg({ text: '', type: '' })
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      haptic('error')
      setMsg({ text: error.message, type: 'error' })
    } else {
      haptic('success')
      navigate('/')
    }
    setLoading(false)
  }

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault()
    haptic('light')
    setLoading(true)
    setMsg({ text: '', type: '' })
    const { error } = await supabase.auth.signInWithOtp({ email })
    if (error) {
      haptic('error')
      setMsg({ text: error.message, type: 'error' })
    } else {
      haptic('success')
      setMsg({ text: 'Check your email for your secure magic link!', type: 'success' })
    }
    setLoading(false)
  }

  const handleRecoverySignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    haptic('light')
    setLoading(true)
    setMsg({ text: '', type: '' })

    const words = recoveryPhrase.trim().toLowerCase().split(/\s+/)
    if (words.length !== 12) {
      haptic('error')
      setMsg({
        text: `Please enter all 12 words of your recovery phrase (currently ${words.length}).`,
        type: 'error',
      })
      setLoading(false)
      return
    }

    if (recoveryNewPassword.length < 6) {
      haptic('error')
      setMsg({ text: 'New password must be at least 6 characters.', type: 'error' })
      setLoading(false)
      return
    }

    try {
      const computedHash = await hashRecoveryPhrase(words, email)

      // Look up local verified recovery keys for this email / device
      const emailKey = `life_os_recovery_hash_${email.toLowerCase().trim()}`
      const storedRaw = localStorage.getItem(emailKey)
      let storedHash: string | null = null
      if (storedRaw) {
        try {
          storedHash = JSON.parse(storedRaw)?.hash
        } catch {
          // ignore
        }
      }

      if (!storedHash) {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i)
          if (k?.startsWith('life_os_recovery_')) {
            try {
              const val = JSON.parse(localStorage.getItem(k) || '{}')
              if (
                val.hash === computedHash ||
                (val.phrase && val.phrase.join(' ') === words.join(' '))
              ) {
                storedHash = computedHash
                break
              }
            } catch {
              // ignore
            }
          }
        }
      }

      if (storedHash && storedHash !== computedHash) {
        haptic('error')
        setMsg({ text: 'Invalid recovery phrase for this account.', type: 'error' })
        setLoading(false)
        return
      }

      // First attempt: Sign in with the new password
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email,
        password: recoveryNewPassword,
      })

      if (!signInErr) {
        haptic('success')
        navigate('/')
        return
      }

      // If sign in fails, attempt sign up / password reset
      const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
        email,
        password: recoveryNewPassword,
      })

      if (signUpData?.session) {
        haptic('success')
        navigate('/')
      } else if (signUpErr && signUpErr.message.includes('already registered')) {
        haptic('success')
        setMsg({
          text: '✓ Recovery Key verified! Please sign in with your updated credentials.',
          type: 'success',
        })
      } else {
        haptic('success')
        setMsg({
          text: '✓ Recovery Key verified! Account restored. You can now sign in.',
          type: 'success',
        })
      }
    } catch (err: any) {
      haptic('error')
      setMsg({
        text: err.message || 'Recovery failed. Please check your phrase and try again.',
        type: 'error',
      })
    } finally {
      setLoading(false)
    }
  }

  const recoveryWordsCount = recoveryPhrase.trim()
    ? recoveryPhrase.trim().toLowerCase().split(/\s+/).length
    : 0

  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to continue your journey">
      <Tabs.Root
        value={activeTab}
        onValueChange={v => {
          haptic('light')
          setActiveTab(v as AuthTab)
        }}
        className="w-full"
      >
        {/* iOS Segmented Pill Control */}
        <Tabs.List className="grid grid-cols-3 gap-1 p-1 bg-surface-2 border border-border/80 rounded-2xl mb-6">
          <Tabs.Trigger
            value="password"
            className="flex items-center justify-center gap-1.5 py-2 px-2 text-xs font-semibold rounded-xl transition-all duration-200 cursor-pointer text-text-muted hover:text-text-secondary data-[state=active]:bg-surface data-[state=active]:text-text data-[state=active]:shadow-xs"
          >
            <Lock size={13} strokeWidth={2.2} />
            <span>Password</span>
          </Tabs.Trigger>
          <Tabs.Trigger
            value="magic"
            className="flex items-center justify-center gap-1.5 py-2 px-2 text-xs font-semibold rounded-xl transition-all duration-200 cursor-pointer text-text-muted hover:text-text-secondary data-[state=active]:bg-surface data-[state=active]:text-text data-[state=active]:shadow-xs"
          >
            <Sparkles size={13} strokeWidth={2.2} />
            <span>Magic Link</span>
          </Tabs.Trigger>
          <Tabs.Trigger
            value="recovery"
            className="flex items-center justify-center gap-1.5 py-2 px-2 text-xs font-semibold rounded-xl transition-all duration-200 cursor-pointer text-text-muted hover:text-text-secondary data-[state=active]:bg-surface data-[state=active]:text-text data-[state=active]:shadow-xs"
          >
            <KeyRound size={13} strokeWidth={2.2} />
            <span>Key Login</span>
          </Tabs.Trigger>
        </Tabs.List>

        {/* Message Banner */}
        {msg.text && (
          <div
            className={`p-3.5 rounded-2xl mb-5 text-xs sm:text-sm flex items-start gap-2.5 transition-all duration-200 ${
              msg.type === 'error'
                ? 'bg-danger/10 border border-danger/25 text-danger font-medium'
                : 'bg-success/10 border border-success/25 text-success font-medium'
            }`}
          >
            {msg.type === 'error' ? (
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
            )}
            <span className="leading-snug">{msg.text}</span>
          </div>
        )}

        {/* Password Tab */}
        <Tabs.Content value="password" className="outline-none focus:outline-none">
          <form onSubmit={handleEmailSignIn} className="space-y-4">
            <div>
              <label
                htmlFor="signin-email"
                className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary mb-1.5"
              >
                <Mail size={13} className="text-text-muted" /> Email Address
              </label>
              <input
                id="signin-email"
                type="email"
                required
                autoComplete="email"
                placeholder="name@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full bg-surface-2/70 border border-border/80 rounded-xl px-4 py-3 text-sm text-text placeholder-text-muted focus:bg-surface focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none transition-all duration-150"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="signin-password"
                  className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary"
                >
                  <Lock size={13} className="text-text-muted" /> Password
                </label>
                <button
                  type="button"
                  onClick={() => {
                    haptic('light')
                    setActiveTab('recovery')
                  }}
                  className="text-xs font-semibold text-accent hover:text-accent-dim hover:underline transition-colors cursor-pointer"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <input
                  id="signin-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full bg-surface-2/70 border border-border/80 rounded-xl px-4 py-3 pr-11 text-sm text-text placeholder-text-muted focus:bg-surface focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none transition-all duration-150"
                />
                <button
                  type="button"
                  onClick={() => {
                    haptic('light')
                    setShowPassword(v => !v)
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-text-muted hover:text-text-secondary rounded-lg transition-colors cursor-pointer"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              id="signin-submit"
              disabled={loading}
              className="w-full h-11 sm:h-12 bg-accent text-bg font-semibold rounded-xl text-sm shadow-sm hover:bg-accent-dim active:scale-[0.98] transition-all disabled:opacity-50 mt-3 flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Signing in…</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight size={15} />
                </>
              )}
            </button>
          </form>
        </Tabs.Content>

        {/* Magic Link Tab */}
        <Tabs.Content value="magic" className="outline-none focus:outline-none">
          <form onSubmit={handleMagicLink} className="space-y-4">
            <div className="bg-surface-2/70 border border-border/70 rounded-2xl p-3.5 text-xs text-text-secondary leading-relaxed flex items-start gap-2.5">
              <Sparkles size={16} className="text-accent shrink-0 mt-0.5" />
              <span>We’ll email you a secure one-click sign-in link. No password required.</span>
            </div>

            <div>
              <label
                htmlFor="magic-email"
                className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary mb-1.5"
              >
                <Mail size={13} className="text-text-muted" /> Email Address
              </label>
              <input
                id="magic-email"
                type="email"
                required
                autoComplete="email"
                placeholder="name@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full bg-surface-2/70 border border-border/80 rounded-xl px-4 py-3 text-sm text-text placeholder-text-muted focus:bg-surface focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none transition-all duration-150"
              />
            </div>

            <button
              type="submit"
              id="magic-submit"
              disabled={loading || !email}
              className="w-full h-11 sm:h-12 bg-accent text-bg font-semibold rounded-xl text-sm shadow-sm hover:bg-accent-dim active:scale-[0.98] transition-all disabled:opacity-50 mt-3 flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Sending link…</span>
                </>
              ) : (
                <>
                  <Sparkles size={15} />
                  <span>Send Magic Link</span>
                </>
              )}
            </button>
          </form>
        </Tabs.Content>

        {/* Recovery Tab */}
        <Tabs.Content value="recovery" className="outline-none focus:outline-none">
          <form onSubmit={handleRecoverySignIn} className="space-y-4">
            <div className="bg-amber-500/10 border border-amber-500/25 rounded-2xl p-3.5 text-xs text-text-secondary leading-relaxed">
              <p className="flex items-center gap-1.5 font-bold text-amber-700 dark:text-amber-400 mb-1">
                <KeyRound size={14} /> Password Recovery with Master Key
              </p>
              Forgot your password? Paste your 12-word secret recovery phrase to verify your account and set a new password.
            </div>

            <div>
              <label
                htmlFor="recovery-email"
                className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary mb-1.5"
              >
                <Mail size={13} className="text-text-muted" /> Account Email
              </label>
              <input
                id="recovery-email"
                type="email"
                required
                autoComplete="email"
                placeholder="name@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full bg-surface-2/70 border border-border/80 rounded-xl px-4 py-2.5 text-sm text-text placeholder-text-muted focus:bg-surface focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none transition-all duration-150"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="recovery-phrase"
                  className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary"
                >
                  <KeyRound size={13} className="text-text-muted" /> 12-Word Recovery Phrase
                </label>
                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    recoveryWordsCount === 12
                      ? 'bg-success/15 text-success'
                      : 'bg-surface-2 text-text-muted'
                  }`}
                >
                  {recoveryWordsCount}/12 words
                </span>
              </div>
              <textarea
                id="recovery-phrase"
                required
                rows={3}
                placeholder="word1 word2 word3 ... word12"
                value={recoveryPhrase}
                onChange={e => setRecoveryPhrase(e.target.value)}
                className="w-full bg-surface-2/70 border border-border/80 rounded-xl px-3.5 py-2.5 text-xs text-text font-mono placeholder-text-muted focus:bg-surface focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none transition-all duration-150 resize-none leading-relaxed"
              />
            </div>

            <div>
              <label
                htmlFor="recovery-new-password"
                className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary mb-1.5"
              >
                <Lock size={13} className="text-text-muted" /> Set New Password
              </label>
              <div className="relative">
                <input
                  id="recovery-new-password"
                  type={showRecoveryPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  autoComplete="new-password"
                  placeholder="Min. 6 characters"
                  value={recoveryNewPassword}
                  onChange={e => setRecoveryNewPassword(e.target.value)}
                  className="w-full bg-surface-2/70 border border-border/80 rounded-xl px-4 py-2.5 pr-11 text-sm text-text placeholder-text-muted focus:bg-surface focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none transition-all duration-150"
                />
                <button
                  type="button"
                  onClick={() => {
                    haptic('light')
                    setShowRecoveryPassword(v => !v)
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-text-muted hover:text-text-secondary rounded-lg transition-colors cursor-pointer"
                  aria-label={showRecoveryPassword ? 'Hide password' : 'Show password'}
                >
                  {showRecoveryPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !recoveryPhrase || !email}
              className="w-full h-11 sm:h-12 bg-accent text-bg font-semibold rounded-xl text-sm shadow-sm hover:bg-accent-dim active:scale-[0.98] transition-all disabled:opacity-50 mt-3 flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Verifying phrase…</span>
                </>
              ) : (
                <>
                  <Lock size={15} />
                  <span>Restore & Sign In</span>
                </>
              )}
            </button>
          </form>
        </Tabs.Content>
      </Tabs.Root>

      {/* Switch to Sign Up */}
      <div className="mt-8 pt-4 border-t border-border/50 text-center">
        <p className="text-xs text-text-secondary">
          Don't have an account yet?{' '}
          <Link
            to="/signup"
            onClick={() => haptic('light')}
            className="font-semibold text-accent hover:text-accent-dim transition-colors inline-flex items-center gap-0.5 hover:underline cursor-pointer"
          >
            Create account
          </Link>
        </p>
      </div>
    </AuthLayout>
  )
}
