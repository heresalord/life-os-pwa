import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { AuthLayout } from '../../components/auth/AuthLayout'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, User, Mail, Lock, Loader2, AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react'
import { haptic } from '../../lib/haptic'

export function SignUpPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<{ text: string; type: 'error' | 'success' | '' }>({ text: '', type: '' })
  const navigate = useNavigate()

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    haptic('light')
    setLoading(true)
    setMsg({ text: '', type: '' })

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } },
    })

    if (error) {
      haptic('error')
      setMsg({ text: error.message, type: 'error' })
    } else if (data.user && !data.session) {
      // Email confirmation required
      haptic('success')
      setMsg({
        text: '✓ Account created! Check your email to confirm, then sign in.',
        type: 'success',
      })
    } else if (data.session) {
      // Auto-confirmed — navigate to onboarding directly
      haptic('success')
      navigate('/onboarding', { replace: true })
    }

    setLoading(false)
  }

  return (
    <AuthLayout title="Create an account" subtitle="Your calm personal OS awaits">
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

      <form onSubmit={handleSignUp} className="space-y-4">
        <div>
          <label
            htmlFor="signup-name"
            className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary mb-1.5"
          >
            <User size={13} className="text-text-muted" /> Display Name
          </label>
          <input
            id="signup-name"
            type="text"
            required
            autoComplete="name"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="How should we call you?"
            className="w-full bg-surface-2/70 border border-border/80 rounded-xl px-4 py-3 text-sm text-text placeholder-text-muted focus:bg-surface focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none transition-all duration-150"
          />
        </div>

        <div>
          <label
            htmlFor="signup-email"
            className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary mb-1.5"
          >
            <Mail size={13} className="text-text-muted" /> Email Address
          </label>
          <input
            id="signup-email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="name@example.com"
            className="w-full bg-surface-2/70 border border-border/80 rounded-xl px-4 py-3 text-sm text-text placeholder-text-muted focus:bg-surface focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none transition-all duration-150"
          />
        </div>

        <div>
          <label
            htmlFor="signup-password"
            className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary mb-1.5"
          >
            <Lock size={13} className="text-text-muted" /> Password
          </label>
          <div className="relative">
            <input
              id="signup-password"
              type={showPassword ? 'text' : 'password'}
              required
              autoComplete="new-password"
              minLength={6}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Min. 6 characters"
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
          id="signup-submit"
          disabled={loading}
          className="w-full h-11 sm:h-12 bg-accent text-bg font-semibold rounded-xl text-sm shadow-sm hover:bg-accent-dim active:scale-[0.98] transition-all disabled:opacity-50 mt-3 flex items-center justify-center gap-2 cursor-pointer"
        >
          {loading ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              <span>Creating account…</span>
            </>
          ) : (
            <>
              <span>Sign Up</span>
              <ArrowRight size={15} />
            </>
          )}
        </button>
      </form>

      {/* Switch to Sign In */}
      <div className="mt-8 pt-4 border-t border-border/50 text-center">
        <p className="text-xs text-text-secondary">
          Already have an account?{' '}
          <Link
            to="/signin"
            onClick={() => haptic('light')}
            className="font-semibold text-accent hover:text-accent-dim transition-colors inline-flex items-center gap-0.5 hover:underline cursor-pointer"
          >
            Sign in
          </Link>
        </p>
      </div>
    </AuthLayout>
  )
}
