import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { AuthLayout } from '../../components/auth/AuthLayout'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'

export function SignUpPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState({ text: '', type: '' })
  const navigate = useNavigate()

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMsg({ text: '', type: '' })

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } },
    })

    if (error) {
      setMsg({ text: error.message, type: 'error' })
    } else if (data.user && !data.session) {
      // Email confirmation required
      setMsg({
        text: '✓ Account created! Check your email to confirm, then sign in.',
        type: 'success',
      })
    } else if (data.session) {
      // Auto-confirmed — navigate to onboarding directly
      navigate('/onboarding', { replace: true })
    }

    setLoading(false)
  }

  const msgColor =
    msg.type === 'error'
      ? 'bg-danger/10 border-danger/30 text-danger'
      : 'bg-success/10 border-success/30 text-success'

  return (
    <AuthLayout title="Create an account" subtitle="Your calm personal OS awaits">
      {msg.text && (
        <div className={`p-3 rounded-lg mb-4 text-sm border ${msgColor}`}>{msg.text}</div>
      )}

      <form onSubmit={handleSignUp} className="space-y-4">
        <div>
          <label className="block text-sm text-text-secondary mb-1.5">Display Name</label>
          <input
            id="signup-name"
            type="text"
            required
            autoComplete="name"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="How should we call you?"
            className="w-full bg-surface-2 border border-border rounded-lg px-4 py-3 text-text placeholder-text-muted focus:border-accent focus:outline-none transition-colors"
          />
        </div>
        <div>
          <label className="block text-sm text-text-secondary mb-1.5">Email</label>
          <input
            id="signup-email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full bg-surface-2 border border-border rounded-lg px-4 py-3 text-text placeholder-text-muted focus:border-accent focus:outline-none transition-colors"
          />
        </div>
        <div>
          <label className="block text-sm text-text-secondary mb-1.5">Password</label>
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
              className="w-full bg-surface-2 border border-border rounded-lg px-4 py-3 pr-11 text-text placeholder-text-muted focus:border-accent focus:outline-none transition-colors"
            />
            <button
              type="button"
              onClick={() => setShowPassword(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary transition-colors"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>
        <button
          type="submit"
          id="signup-submit"
          disabled={loading}
          className="w-full bg-accent text-bg font-medium rounded-lg py-3 hover:bg-accent-dim transition-colors disabled:opacity-50 mt-2"
        >
          {loading ? 'Creating account...' : 'Sign Up'}
        </button>
      </form>

      <p className="mt-8 text-center text-sm text-text-secondary">
        Already have an account?{' '}
        <Link to="/signin" className="text-accent hover:underline">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  )
}
