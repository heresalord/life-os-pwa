import React from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, CheckSquare, DollarSign, Target, BookOpen,
  CalendarDays, Inbox, FileText, Search, Settings, X
} from 'lucide-react'
import { SyncStatusDot } from '../SyncStatusDot'
import { useAuth } from '../../hooks/useAuth'
import { useAppStore } from '../../store/useAppStore'
import { displayDate } from '../../lib/dateUtils'
import { InboxFAB } from '../inbox/InboxFAB'
import { InstallBanner } from './InstallBanner'
import { DesktopSidebar } from './DesktopSidebar'
import { DesktopTopbar } from './DesktopTopbar'
import { useUserSettings } from '../../hooks/useUserSettings'
import clsx from 'clsx'

// Full catalogue of navigable items (Home is always fixed)
export const ALL_NAV_OPTIONS = [
  { key: 'tasks',   to: '/tasks',   icon: CheckSquare,  label: 'Tasks'   },
  { key: 'finance', to: '/finance', icon: DollarSign,   label: 'Finance' },
  { key: 'goals',   to: '/goals',   icon: Target,       label: 'Goals'   },
  { key: 'books',   to: '/books',   icon: BookOpen,     label: 'Books'   },
  { key: 'agenda',  to: '/agenda',  icon: CalendarDays, label: 'Agenda'  },
  { key: 'inbox',   to: '/inbox',   icon: Inbox,        label: 'Inbox'   },
  { key: 'notes',   to: '/notes',   icon: FileText,     label: 'Notes'   },
  { key: 'search',  to: '/search',  icon: Search,       label: 'Search'  },
]

const HOME_NAV = { key: 'home', to: '/', icon: LayoutDashboard, label: 'Home' }

const secondaryNav = [
  { to: '/agenda', icon: CalendarDays, label: 'Agenda' },
  { to: '/inbox',  icon: Inbox,        label: 'Inbox'  },
  { to: '/notes',  icon: FileText,     label: 'Notes'  },
]

interface AppShellProps {
  children: React.ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const { profile, signOut } = useAuth()
  const { selectedDate, timezone, navItems } = useAppStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = React.useState(false)
  const [animKey, setAnimKey] = React.useState(location.pathname)

  // Build bottom nav from user preference (Home is always slot 1)
  const dynamicNav = [
    HOME_NAV,
    ...navItems
      .map(key => ALL_NAV_OPTIONS.find(o => o.key === key))
      .filter(Boolean) as typeof ALL_NAV_OPTIONS,
  ]

  // Trigger slide animation on route change
  React.useEffect(() => {
    setAnimKey(location.pathname)
  }, [location.pathname])

  const { data: settings } = useUserSettings()

  const today = new Date().toLocaleDateString('en-CA', { timeZone: timezone })
  const isTimeTravel = selectedDate !== today

  const displayName = profile?.display_name || 'You'
  const initials = displayName.slice(0, 2).toUpperCase()

  React.useEffect(() => {
    if (settings?.theme) {
      document.documentElement.dataset.theme = settings.theme

      // Update status bar theme-color
      let metaThemeColor = document.querySelector('meta[name="theme-color"]')
      if (!metaThemeColor) {
        metaThemeColor = document.createElement('meta')
        metaThemeColor.setAttribute('name', 'theme-color')
        document.head.appendChild(metaThemeColor)
      }
      metaThemeColor.setAttribute('content', settings.theme === 'light' ? '#fcfbfa' : '#0a0a0a')
    }
  }, [settings?.theme])

  return (
    // ── Shell root: mobile = column stack, desktop = sidebar + content row ──
    <div className="flex flex-col md:flex-row min-h-screen bg-bg">

      {/* ── Desktop sidebar — hidden on mobile ── */}
      <DesktopSidebar />

      {/* ── Content column: topbar + page content ── */}
      <div className="flex flex-col flex-1 min-w-0">

        {/* ── Mobile header — hidden on desktop ── */}
        <header className="md:hidden sticky top-0 z-30 bg-bg/90 backdrop-blur-md border-b border-border">
          <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
            <div className="flex flex-col leading-tight relative group">
              <span className="text-xs text-text-muted font-body uppercase tracking-widest">Life OS</span>
              <div className="relative">
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => useAppStore.getState().setSelectedDate(e.target.value)}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                />
                <span className="text-sm text-text font-medium group-hover:text-accent transition-colors flex items-center gap-1">
                  {displayDate(selectedDate, 'EEE, MMM d')}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <SyncStatusDot />
              <button
                onClick={() => navigate('/search')}
                className="w-8 h-8 flex items-center justify-center text-text-secondary hover:text-text transition-colors"
                aria-label="Search"
              >
                <Search size={18} />
              </button>

              <div className="relative">
                <button
                  onClick={() => setMenuOpen(v => !v)}
                  className="w-8 h-8 rounded-full bg-accent/20 border border-accent/40 flex items-center justify-center text-accent text-xs font-medium hover:bg-accent/30 transition-colors"
                >
                  {initials}
                </button>

                {menuOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                    <div className="absolute right-0 top-10 z-50 w-48 bg-surface border border-border rounded-xl shadow-xl overflow-hidden">
                      <div className="px-4 py-3 border-b border-border">
                        <p className="text-sm text-text font-medium truncate">{displayName}</p>
                        <p className="text-xs text-text-muted truncate">{profile?.timezone}</p>
                      </div>
                      <nav className="py-1">
                        {secondaryNav.map(({ to, icon: Icon, label }) => (
                          <NavLink key={to} to={to} onClick={() => setMenuOpen(false)}
                            className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-text-secondary hover:text-text hover:bg-surface-2 transition-colors">
                            <Icon size={15} />
                            {label}
                          </NavLink>
                        ))}
                        <div className="border-t border-border my-1" />
                        <NavLink to="/settings" onClick={() => setMenuOpen(false)}
                          className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-text-secondary hover:text-text hover:bg-surface-2 transition-colors">
                          <Settings size={15} />
                          Settings
                        </NavLink>
                        <button onClick={() => { signOut(); setMenuOpen(false) }}
                          className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-danger hover:bg-danger/10 transition-colors">
                          <X size={15} />
                          Sign Out
                        </button>
                      </nav>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* ── Desktop topbar — hidden on mobile ── */}
        <DesktopTopbar />

        {/* ── Time-travel banner — shown on both breakpoints ── */}
        {isTimeTravel && (
          <div className="bg-timetravel/15 border-b border-timetravel/30 px-4 py-2 flex items-center justify-between">
            <span className="text-xs text-timetravel font-medium">
              🕰 Viewing {displayDate(selectedDate, 'MMMM d, yyyy')}
            </span>
            <button
              onClick={() => useAppStore.getState().resetToToday()}
              className="text-xs text-timetravel underline hover:no-underline"
            >
              Back to Today
            </button>
          </div>
        )}

        {/* ── Page content ── */}
        <main className={clsx(
          // Mobile: full-width constrained column with space for bottom nav
          'flex-1 w-full px-4 py-4 pb-28 overflow-x-hidden',
          // Mobile centering (preserved exactly)
          'max-w-2xl mx-auto',
          // Desktop: release the constraint, fill the remaining width
          'md:max-w-none md:mx-0 md:pb-6 md:px-6 md:py-6',
        )}>
          <div key={animKey} className="page-enter">
            {children}
          </div>
        </main>
      </div>

      {/* ── Mobile-only floating elements ── */}
      <div className="md:hidden">
        <InboxFAB />
      </div>

      <InstallBanner />

      {/* ── Mobile bottom nav — hidden on desktop ── */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-surface/95 backdrop-blur-md border-t border-border"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="max-w-2xl mx-auto flex items-center justify-around h-16">
          {dynamicNav.map(({ to, icon: Icon, label, key }) => (
            <NavLink
              key={key}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                clsx('flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition-all',
                  isActive ? 'text-accent' : 'text-text-muted hover:text-text-secondary')
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={20} strokeWidth={isActive ? 2.5 : 1.75} />
                  <span className={clsx('text-[10px] font-medium', isActive ? 'text-accent' : '')}>
                    {label}
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
