import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { AuthLayout } from '../../components/auth/AuthLayout'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import * as Tabs from '@radix-ui/react-tabs'

export function SignInPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState({ text: '', type: '' })
  const navigate = useNavigate()

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMsg({ text: '', type: '' })
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setMsg({ text: error.message, type: 'error' })
    else navigate('/')
    setLoading(false)
  }

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMsg({ text: '', type: '' })
    const { error } = await supabase.auth.signInWithOtp({ email })
    if (error) setMsg({ text: error.message, type: 'error' })
    else setMsg({ text: 'Check your email for the magic link!', type: 'success' })
    setLoading(false)
  }

  const handleOAuth = async (provider: 'google' | 'apple') => {
    await supabase.auth.signInWithOAuth({ provider })
  }

  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to your account">
      <Tabs.Root defaultValue="password" className="w-full">
        <Tabs.List className="flex border-b border-border mb-6">
          <Tabs.Trigger
            value="password"
            className="flex-1 pb-3 text-sm text-text-secondary data-[state=active]:text-accent data-[state=active]:border-b-2 data-[state=active]:border-accent font-medium transition-colors cursor-pointer"
          >
            Password
          </Tabs.Trigger>
          <Tabs.Trigger
            value="magic"
            className="flex-1 pb-3 text-sm text-text-secondary data-[state=active]:text-accent data-[state=active]:border-b-2 data-[state=active]:border-accent font-medium transition-colors cursor-pointer"
          >
            Magic Link
          </Tabs.Trigger>
        </Tabs.List>

        {msg.text && (
          <div className={`p-3 rounded-lg mb-4 text-sm ${msg.type === 'error' ? 'bg-danger/10 border border-danger/30 text-danger' : 'bg-success/10 border border-success/30 text-success'}`}>
            {msg.text}
          </div>
        )}

        <Tabs.Content value="password">
          <form onSubmit={handleEmailSignIn} className="space-y-4">
            <div>
              <label className="block text-sm text-text-secondary mb-1.5">Email</label>
              <input
                id="signin-email"
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
                  id="signin-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
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
              id="signin-submit"
              disabled={loading}
              className="w-full bg-accent text-bg font-medium rounded-lg py-3 hover:bg-accent-dim transition-colors disabled:opacity-50 mt-2"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </Tabs.Content>

        <Tabs.Content value="magic">
          <form onSubmit={handleMagicLink} className="space-y-4">
            <div>
              <label className="block text-sm text-text-secondary mb-1.5">Email</label>
              <input
                id="magic-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full bg-surface-2 border border-border rounded-lg px-4 py-3 text-text placeholder-text-muted focus:border-accent focus:outline-none transition-colors"
              />
            </div>
            <button
              type="submit"
              id="magic-submit"
              disabled={loading}
              className="w-full bg-accent text-bg font-medium rounded-lg py-3 hover:bg-accent-dim transition-colors disabled:opacity-50"
            >
              {loading ? 'Sending link...' : 'Send Magic Link'}
            </button>
          </form>
        </Tabs.Content>
      </Tabs.Root>

      <div className="mt-8">
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-3 bg-surface text-text-muted">Or continue with</span>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            onClick={() => handleOAuth('google')}
            className="flex justify-center items-center gap-2 bg-surface-2 border border-border rounded-lg py-2.5 text-sm text-text hover:bg-muted transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path fill="currentColor" d="M21.35,11.1H12.18V13.83H18.69C18.36,17.64 15.19,19.27 12.19,19.27C8.36,19.27 5,16.25 5,12C5,7.9 8.2,4.73 12.2,4.73C15.29,4.73 17.1,6.7 17.1,6.7L19,4.72C19,4.72 16.56,2 12.1,2C6.42,2 2.03,6.8 2.03,12C2.03,17.05 6.16,22 12.25,22C17.6,22 21.5,18.33 21.5,12.91C21.5,11.76 21.35,11.1 21.35,11.1Z" />
            </svg>
            Google
          </button>
          <button
            onClick={() => handleOAuth('apple')}
            className="flex justify-center items-center gap-2 bg-surface-2 border border-border rounded-lg py-2.5 text-sm text-text hover:bg-muted transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path fill="currentColor" d="M14.24,5.42C14.39,4.1 15.34,3.09 16.59,2.83C16.84,4.2 16.03,5.4 14.88,6.31C14.61,6.54 14.3,6.7 13.97,6.81C13.85,5.55 14.24,5.42 14.24,5.42M19.12,14.41C19.12,18 16.54,21 14.5,21C13.19,21 12.44,20.35 11.23,20.35C9.97,20.35 9,21 7.84,21C5.7,21 3.26,17.84 3.26,13.68C3.26,10.15 5.5,8.12 7.87,8.12C9.09,8.12 10,8.71 10.96,8.71C11.96,8.71 13.1,8 14.47,8C15.93,8 17.15,8.68 17.87,9.75C14.73,11.59 15.42,15.65 19.12,14.41Z" />
            </svg>
            Apple
          </button>
        </div>
      </div>

      <p className="mt-8 text-center text-sm text-text-secondary">
        Don't have an account?{' '}
        <Link to="/signup" className="text-accent hover:underline">
          Sign up
        </Link>
      </p>
    </AuthLayout>
  )
}
