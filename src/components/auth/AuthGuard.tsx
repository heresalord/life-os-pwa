import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

export function AuthGuard() {
  const { user, profile, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex flex-col items-center justify-center gap-3">
        <div className="text-3xl font-display text-accent">Life OS</div>
        <div className="w-5 h-5 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/signin" replace />
  }

  // Redirect to onboarding if not complete
  if (profile && !profile.onboarded && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />
  }

  // If onboarded and trying to visit /onboarding, redirect home
  if (profile?.onboarded && location.pathname === '/onboarding') {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}
