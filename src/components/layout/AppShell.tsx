import React from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Search, Clock, Plus,
} from 'lucide-react'
import { SyncStatusDot } from '../SyncStatusDot'
import { useHasSyncIssue } from '../../hooks/useHasSyncIssue'
import { useAuth } from '../../hooks/useAuth'
import { useAppStore } from '../../store/useAppStore'
import { useRecoveryKeyStatus } from '../../hooks/useRecoveryKeyStatus'
import { displayDate } from '../../lib/dateUtils'
import { hapticLight } from '../../lib/haptics'
import { useOnlineStatus } from '../../hooks/useOnlineStatus'
import { ContextualFAB } from './ContextualFAB'
import { QuickCaptureModal } from '../inbox/QuickCaptureModal'
import { InstallBanner } from './InstallBanner'
import { DesktopSidebar } from './DesktopSidebar'
import { DesktopTopbar } from './DesktopTopbar'
import { NotificationCenter } from '../notifications/NotificationCenter'
import { useNavSync } from '../../hooks/useNavSync'
import { useWidgetSync } from '../../hooks/useWidgetSync'
import { useTranslation } from '../../i18n'
import { ErrorBoundary } from '../ErrorBoundary'
import clsx from 'clsx'

import { ALL_NAV_OPTIONS } from '../../lib/constants'

const HOME_NAV = { key: 'home', to: '/', icon: LayoutDashboard, label: 'Home' }

/**
 * Route order used to determine slide direction.
 * Lower index = further left. Navigating to a higher index = slide from right.
 */
const ROUTE_ORDER = ['/', '/day', '/tasks', '/finance', '/goals', '/projects', '/books', '/agenda', '/inbox', '/notes', '/search', '/more', '/profile', '/settings']

function getRouteIndex(pathname: string): number {
  const idx = ROUTE_ORDER.indexOf(pathname)
  return idx === -1 ? 999 : idx
}

interface AppShellProps { children: React.ReactNode }

export function AppShell({ children }: AppShellProps) {
  const { profile } = useAuth()
  const { selectedDate, timezone, navItems } = useAppStore()
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useTranslation()
  const isOnline = useOnlineStatus()
  const [quickCaptureOpen, setQuickCaptureOpen] = React.useState(false)
  // Offline banner is ~32px tall; header must sit below it
  const offlineBannerH = isOnline ? 0 : 32

  // Track previous pathname to determine slide direction
  const prevPathnameRef = React.useRef(location.pathname)
  const [pageKey, setPageKey] = React.useState(location.pathname)
  const [slideClass, setSlideClass] = React.useState('page-enter')

  useNavSync()
  useWidgetSync()

  const dynamicNav = [
    HOME_NAV,
    ...navItems
      .map(key => ALL_NAV_OPTIONS.find(o => o.key === key))
      .filter(Boolean) as typeof ALL_NAV_OPTIONS,
  ]

  React.useEffect(() => {
    const prev = prevPathnameRef.current
    const next = location.pathname

    if (prev !== next) {
      const prevIdx = getRouteIndex(prev)
      const nextIdx = getRouteIndex(next)

      // On mobile, use directional slides. Desktop always fades (via @media in CSS).
      if (nextIdx > prevIdx) {
        setSlideClass('page-slide-right')
      } else if (nextIdx < prevIdx) {
        setSlideClass('page-slide-left')
      } else {
        setSlideClass('page-enter')
      }

      setPageKey(next)
      prevPathnameRef.current = next
    }
  }, [location.pathname])

  const today = new Date().toLocaleDateString('en-CA', { timeZone: timezone })
  const isTimeTravel = selectedDate !== today

  const displayName = profile?.display_name || 'You'
  const initials = displayName.slice(0, 2).toUpperCase()
  const hasSyncIssue = useHasSyncIssue()
  const { isVerified: isRecoveryVerified } = useRecoveryKeyStatus()

  // Translate nav label using JSON keys; fall back to the English label
  const navLabel = (key: string, fallback: string) =>
    t(`nav.${key}`, fallback)

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-bg">

      <DesktopSidebar />

      <div className="flex flex-col flex-1 min-w-0">

        {/* ── Mobile header ─────────────────────────────────────────────── */}
        <header
          className="md:hidden sticky z-30 bg-bg border-b border-border"
          style={{ 
            paddingTop: 'env(safe-area-inset-top)',
            top: offlineBannerH,
          }}
        >
          <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">

            {/* Left: date picker */}
            <div className="relative group">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => useAppStore.getState().setSelectedDate(e.target.value)}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
              />
              <span className="text-sm text-text-secondary font-medium group-hover:text-accent transition-colors">
                {displayDate(selectedDate, 'EEE, MMM d')}
              </span>
            </div>

            {/* Right: actions */}
            <div className="flex items-center gap-1">
              {hasSyncIssue && <SyncStatusDot />}

              <ErrorBoundary inline>
                <NotificationCenter />
              </ErrorBoundary>

              <button
                onClick={() => navigate('/search')}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center text-text-secondary hover:text-text transition-colors"
                aria-label="Search"
              >
                <Search size={20} />
              </button>

              {/* Quick capture button */}
              <button
                onClick={() => { hapticLight(); setQuickCaptureOpen(true) }}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center text-text-secondary hover:text-text transition-colors"
                aria-label="Quick capture"
                title="Quick capture"
              >
                <Plus size={20} />
              </button>

              {/* Avatar → /more (Profile, Settings, Routines, and Modules) */}
              <button
                onClick={() => navigate('/more')}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center"
                aria-label="Profile and More"
              >
                <div className="relative w-8 h-8 rounded-full bg-accent/20 border border-accent/40 flex items-center justify-center text-accent text-xs font-semibold hover:bg-accent/30 transition-colors">
                  {initials}
                  {!isRecoveryVerified && (
                    <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-warning ring-2 ring-bg animate-pulse" />
                  )}
                </div>
              </button>
            </div>
          </div>
        </header>

        <DesktopTopbar />

        {/* Time-travel banner */}
        {isTimeTravel && (
          <div className="bg-timetravel/15 border-b border-timetravel/30 px-4 py-2 flex items-center justify-between">
            <span className="flex items-center gap-2 text-xs text-timetravel font-medium">
              <Clock size={14} /> {t('common.viewing', 'Viewing')} {displayDate(selectedDate, 'MMMM d, yyyy')}
            </span>
            <button
              onClick={() => useAppStore.getState().resetToToday()}
              className="text-xs text-timetravel underline hover:no-underline"
            >
              {t('common.back_to_today', 'Back to Today')}
            </button>
          </div>
        )}

        <main className={clsx(
          'flex-1 w-full px-4 py-4 pb-24 overflow-x-hidden',
          'max-w-2xl mx-auto',
          'md:max-w-none md:mx-0 md:pb-6 md:px-6 md:py-6',
        )}>
          <div key={pageKey} className={slideClass}>
            {children}
          </div>
        </main>
      </div>

      <div className="md:hidden">
        <ContextualFAB />
      </div>

      <QuickCaptureModal open={quickCaptureOpen} onOpenChange={setQuickCaptureOpen} />

      <InstallBanner />

      {/* ── Mobile bottom nav ─────────────────────────────────────────── */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-bg border-t border-border"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="max-w-2xl mx-auto flex items-center justify-around h-16">
          {dynamicNav.map(({ to, icon: Icon, label, key }) => (
            <NavLink
              key={key}
              to={to}
              end={to === '/'}
              onClick={() => void hapticLight()}
              className={({ isActive }) =>
                clsx(
                  'flex flex-col items-center gap-1 py-1 min-h-[44px] min-w-[48px] justify-center transition-all',
                  /* 6.6: active tab gets pill background */
                  isActive
                    ? 'nav-pill-active text-accent'
                    : 'px-3 text-text-muted hover:text-text-secondary'
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={20} strokeWidth={isActive ? 2.5 : 1.75} />
                  <span className={clsx('text-[11px] font-medium', isActive ? 'text-accent' : '')}>
                    {navLabel(key, label)}
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
