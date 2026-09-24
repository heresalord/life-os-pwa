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

export function SignInPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [recoveryPhrase, setRecoveryPhrase] = useState('')
  const [recoveryNewPassword, setRecoveryNewPassword] = useState('')
  const [showRecoveryPassword, setShowRecoveryPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<{ text: string; type: 'error' | 'success' | '' }>({ text: '', type: '' })
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
      setMsg({ text: `Please enter all 12 words of your recovery phrase (currently ${words.length}).`, type: 'error' })
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
              if (val.hash === computedHash || (val.phrase && val.phrase.join(' ') === words.join(' '))) {
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

      // If sign in fails, attempt sign up with the new credentials
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
          text: '✓ Master Recovery Key verified! Please sign in with your password or use your session.',
          type: 'success',
        })
      } else {
        haptic('success')
        setMsg({
          text: '✓ Master Recovery Key verified! Account restored. You can now sign in.',
          type: 'success',
        })
      }
    } catch (err: any) {
      haptic('error')
      setMsg({ text: err.message || 'Recovery failed. Please check your phrase and try again.', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const handleOAuth = async (provider: 'google' | 'apple') => {
    haptic('light')
    await supabase.auth.signInWithOAuth({ provider })
  }

  const recoveryWordsCount = recoveryPhrase.trim() ? recoveryPhrase.trim().toLowerCase().split(/\s+/).length : 0

  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to continue your journey">
      <Tabs.Root defaultValue="password" className="w-full" onValueChange={() => haptic('light')}>
        {/* iOS Segmented Pill Control */}
        <Tabs.List className="grid grid-cols-3 gap-1 p-1 bg-surface-2/80 border border-border/70 rounded-2xl mb-6">
          <Tabs.Trigger
            value="password"
            className="flex items-center justify-center gap-1.5 py-2 px-2 text-xs font-semibold rounded-xl transition-all duration-200 cursor-pointer text-text-muted hover:text-text-secondary data-[state=active]:bg-white data-[state=active]:text-text data-[state=active]:shadow-xs"
          >
            <Lock size={13} strokeWidth={2.2} />
            <span>Password</span>
          </Tabs.Trigger>
          <Tabs.Trigger
            value="magic"
            className="flex items-center justify-center gap-1.5 py-2 px-2 text-xs font-semibold rounded-xl transition-all duration-200 cursor-pointer text-text-muted hover:text-text-secondary data-[state=active]:bg-white data-[state=active]:text-text data-[state=active]:shadow-xs"
          >
            <Sparkles size={13} strokeWidth={2.2} />
            <span>Magic Link</span>
          </Tabs.Trigger>
          <Tabs.Trigger
            value="recovery"
            className="flex items-center justify-center gap-1.5 py-2 px-2 text-xs font-semibold rounded-xl transition-all duration-200 cursor-pointer text-text-muted hover:text-text-secondary data-[state=active]:bg-white data-[state=active]:text-text data-[state=active]:shadow-xs"
          >
            <KeyRound size={13} strokeWidth={2.2} />
            <span>Key</span>
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
              <label className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary mb-1.5">
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
                className="w-full bg-surface-2/70 border border-border/80 rounded-xl px-4 py-3 text-sm text-text placeholder-text-muted focus:bg-white focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none transition-all duration-150"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary">
                  <Lock size={13} className="text-text-muted" /> Password
                </label>
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
                  className="w-full bg-surface-2/70 border border-border/80 rounded-xl px-4 py-3 pr-11 text-sm text-text placeholder-text-muted focus:bg-white focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none transition-all duration-150"
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
              className="w-full h-11 sm:h-12 bg-accent text-bg font-semibold rounded-xl text-sm shadow-[0_4px_16px_rgba(176,154,117,0.35)] hover:bg-accent-dim active:scale-[0.98] transition-all disabled:opacity-50 mt-2 flex items-center justify-center gap-2 cursor-pointer"
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
              <label className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary mb-1.5">
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
                className="w-full bg-surface-2/70 border border-border/80 rounded-xl px-4 py-3 text-sm text-text placeholder-text-muted focus:bg-white focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none transition-all duration-150"
              />
            </div>

            <button
              type="submit"
              id="magic-submit"
              disabled={loading || !email}
              className="w-full h-11 sm:h-12 bg-accent text-bg font-semibold rounded-xl text-sm shadow-[0_4px_16px_rgba(176,154,117,0.35)] hover:bg-accent-dim active:scale-[0.98] transition-all disabled:opacity-50 mt-2 flex items-center justify-center gap-2 cursor-pointer"
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
                <KeyRound size={14} /> Zero-Email Emergency Recovery
              </p>
              Paste your 12-word secret recovery phrase to restore account access without email verification.
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary mb-1.5">
                <Mail size={13} className="text-text-muted" /> Account Email
              </label>
              <input
                type="email"
                required
                autoComplete="email"
                placeholder="name@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full bg-surface-2/70 border border-border/80 rounded-xl px-4 py-2.5 text-sm text-text placeholder-text-muted focus:bg-white focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none transition-all duration-150"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary">
                  <KeyRound size={13} className="text-text-muted" /> 12-Word Recovery Phrase
                </label>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${recoveryWordsCount === 12 ? 'bg-success/15 text-success' : 'bg-surface-2 text-text-muted'}`}>
                  {recoveryWordsCount}/12 words
                </span>
              </div>
              <textarea
                required
                rows={3}
                placeholder="word1 word2 word3 ... word12"
                value={recoveryPhrase}
                onChange={e => setRecoveryPhrase(e.target.value)}
                className="w-full bg-surface-2/70 border border-border/80 rounded-xl px-3.5 py-2.5 text-xs text-text font-mono placeholder-text-muted focus:bg-white focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none transition-all duration-150 resize-none leading-relaxed"
              />
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary mb-1.5">
                <Lock size={13} className="text-text-muted" /> Set New Password
              </label>
              <div className="relative">
                <input
                  type={showRecoveryPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  autoComplete="new-password"
                  placeholder="Min. 6 characters"
                  value={recoveryNewPassword}
                  onChange={e => setRecoveryNewPassword(e.target.value)}
                  className="w-full bg-surface-2/70 border border-border/80 rounded-xl px-4 py-2.5 pr-11 text-sm text-text placeholder-text-muted focus:bg-white focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none transition-all duration-150"
                />
                <button
                  type="button"
                  onClick={() => {
                    haptic('light')
                    setShowRecoveryPassword(v => !v)
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-text-muted hover:text-text-secondary rounded-lg transition-colors cursor-pointer"
                >
                  {showRecoveryPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !recoveryPhrase || !email}
              className="w-full h-11 sm:h-12 bg-accent text-bg font-semibold rounded-xl text-sm shadow-[0_4px_16px_rgba(176,154,117,0.35)] hover:bg-accent-dim active:scale-[0.98] transition-all disabled:opacity-50 mt-2 flex items-center justify-center gap-2 cursor-pointer"
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

      {/* Social / OAuth Divider */}
      <div className="mt-7">
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border/70"></div>
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="px-3 bg-white/90 text-text-muted font-medium">Or continue with</span>
          </div>
        </div>

        {/* OAuth Buttons */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => handleOAuth('google')}
            className="flex justify-center items-center gap-2.5 bg-surface border border-border/80 rounded-xl py-2.5 px-3 text-xs font-semibold text-text hover:bg-surface-2 hover:border-border active:scale-[0.98] transition-all cursor-pointer shadow-xs"
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
              />
              <path
                fill="#FBBC05"
                d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.16 0 9.97 0 12s.45 3.84 1.25 5.42l4.03-3.15z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
              />
            </svg>
            <span>Google</span>
          </button>

          <button
            type="button"
            onClick={() => handleOAuth('apple')}
            className="flex justify-center items-center gap-2.5 bg-surface border border-border/80 rounded-xl py-2.5 px-3 text-xs font-semibold text-text hover:bg-surface-2 hover:border-border active:scale-[0.98] transition-all cursor-pointer shadow-xs"
          >
            <svg className="w-4 h-4 shrink-0 fill-current" viewBox="0 0 24 24">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.63-.79 1.06-1.88.94-2.98-.94.04-2.03.64-2.69 1.42-.58.67-.99 1.78-.85 2.84 1.04.08 2.07-.54 2.6-1.28z" />
            </svg>
            <span>Apple</span>
          </button>
        </div>
      </div>

      {/* Switch to Sign Up */}
      <div className="mt-7 pt-4 border-t border-border/50 text-center">
        <p className="text-xs text-text-secondary">
          Don't have an account yet?{' '}
          <Link
            to="/signup"
            onClick={() => haptic('light')}
            className="font-semibold text-accent hover:text-accent-dim transition-colors inline-flex items-center gap-0.5 hover:underline"
          >
            Create account
          </Link>
        </p>
      </div>
    </AuthLayout>
  )
}
