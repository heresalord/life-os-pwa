import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { DbProvider } from '../../db/DbContext'

/**
 * AuthGuard — routing decisions based on profileStatus (A1).
 *
 * Status    | user | Action
 * ----------|------|-----------------------------------------------
 * loading   | any  | Show spinner (waiting for server / cache)
 * ready     | ✓    | If onboarded → app; else → /onboarding
 * missing   | ✓    | → /onboarding (server confirmed no row)
 * unknown   | ✓    | Use cached profile → app (network failure)
 * missing   | ✗    | → /signin (no session at all)
 *
 * "unknown" never redirects to onboarding — a failed fetch and a missing
 * profile row are explicitly different states.
 */
export function AuthGuard() {
  const { user, profile, profileStatus } = useAuth()
  const location = useLocation()

  // ── Still waiting for the first server round-trip ──────────────────────
  // If we have a cached profile in state already (set synchronously from
  // localStorage before the fetch completes) we can skip the spinner.
  if (profileStatus === 'loading' && !profile && !user) {
    return (
      <div className="min-h-screen bg-bg flex flex-col items-center justify-center gap-3">
        <div className="text-3xl font-display text-accent">Kairo</div>
        <div className="w-5 h-5 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
      </div>
    )
  }

  // ── Show loading spinner only while we truly have nothing to show ──────
  if (profileStatus === 'loading' && !user) {
    return (
      <div className="min-h-screen bg-bg flex flex-col items-center justify-center gap-3">
        <div className="text-3xl font-display text-accent">Kairo</div>
        <div className="w-5 h-5 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
      </div>
    )
  }

  // ── No session at all → sign in ────────────────────────────────────────
  if (!user) {
    return <Navigate to="/signin" state={{ from: location }} replace />
  }

  const isOnboarding = location.pathname === '/onboarding'

  // ── Determine whether onboarding is needed ─────────────────────────────
  // Only redirect to onboarding when the server *confirmed* there is no row,
  // or when the server returned a row but onboarded === false.
  // 'unknown' (network failure with cached profile) does NOT redirect.
  const serverConfirmedMissing = profileStatus === 'missing'
  const serverConfirmedNotOnboarded = profileStatus === 'ready' && profile && !profile.onboarded
  const needsOnboarding = serverConfirmedMissing || serverConfirmedNotOnboarded

  if (needsOnboarding && !isOnboarding) {
    return <Navigate to="/onboarding" replace />
  }

  // Already onboarded → don't let them back into onboarding
  if (!needsOnboarding && isOnboarding && profileStatus !== 'loading') {
    return <Navigate to="/" replace />
  }

  // ── Still loading but we have a user — render the app optimistically ───
  // This handles: (a) cached profile was restored before server responded,
  // (b) profile status is 'unknown' due to network failure.
  return (
    <DbProvider userId={user.id}>
      <Outlet />
    </DbProvider>
  )
}
