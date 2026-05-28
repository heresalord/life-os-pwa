import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

export function AuthGuard() {
  const { user, profile, loading } = useAuth()
  const location = useLocation()

  // Show spinner while session + profile are loading
  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex flex-col items-center justify-center gap-3">
        <div className="text-3xl font-display text-accent">Life OS</div>
        <div className="w-5 h-5 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
      </div>
    )
  }

  // Not logged in → sign in
  if (!user) {
    return <Navigate to="/signin" state={{ from: location }} replace />
  }

  const isOnboarding = location.pathname === '/onboarding'
  const needsOnboarding = !profile || !profile.onboarded

  // Not onboarded → force to onboarding (but don't redirect if already there)
  if (needsOnboarding && !isOnboarding) {
    return <Navigate to="/onboarding" replace />
  }

  // Already onboarded → don't let them back into onboarding
  if (!needsOnboarding && isOnboarding) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}
