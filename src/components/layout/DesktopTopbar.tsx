import { useLocation, useNavigate } from 'react-router-dom'
import { Sun, Moon, Search, Settings, LogOut, Plus, Zap } from 'lucide-react'
import { useState } from 'react'
import { useAppStore } from '../../store/useAppStore'
import { useAuth } from '../../hooks/useAuth'
import { displayDate } from '../../lib/dateUtils'
import { SyncStatusDot } from '../SyncStatusDot'
import { useHasSyncIssue } from '../../hooks/useHasSyncIssue'
import { useRecoveryKeyStatus } from '../../hooks/useRecoveryKeyStatus'
import { NavLink } from 'react-router-dom'
import { NotificationCenter } from '../notifications/NotificationCenter'
import { CalendarDays, Inbox, FileText } from 'lucide-react'
import { ErrorBoundary } from '../ErrorBoundary'
import { QuickCaptureModal } from '../inbox/QuickCaptureModal'
import { ROUTES_WITH_ADD_ACTION } from '../../lib/constants'

const pathTitleMap: Record<string, string> = {
  '/':         'Dashboard',
  '/tasks':    'Tasks & Focus',
  '/finance':  'Finance & Budget',
  '/goals':    'Life Goals',
  '/books':    'Reading List',
  '/agenda':   'Agenda & Schedule',
  '/inbox':    'Inbox & Quick Capture',
  '/notes':    'Notes Journal',
  '/search':   'Search Workspace',
  '/settings': 'Settings',
  '/day':      'Daily Log',
  '/day/history': 'Wellbeing History',
}

const secondaryNav = [
  { to: '/agenda', icon: CalendarDays, label: 'Agenda' },
  { to: '/inbox',  icon: Inbox,        label: 'Inbox'  },
  { to: '/notes',  icon: FileText,     label: 'Notes'  },
]

export function DesktopTopbar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { selectedDate } = useAppStore()
  const { profile, signOut } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const [quickCaptureOpen, setQuickCaptureOpen] = useState(false)
  const hasSyncIssue = useHasSyncIssue()

  let title = pathTitleMap[location.pathname]
  if (!title) {
    if (location.pathname.startsWith('/books/author/')) {
      title = 'Author Profile'
    } else if (location.pathname.startsWith('/books/')) {
      title = 'Book Details'
    } else {
      title = 'Life OS'
    }
  }

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Morning' : hour < 18 ? 'Afternoon' : 'Evening'

  const displayName = profile?.display_name || 'You'
  const initials = displayName.slice(0, 2).toUpperCase()

  const { isVerified: isRecoveryVerified } = useRecoveryKeyStatus()

  return (
    <header className="hidden md:flex h-16 items-center justify-between px-6 bg-bg border-b border-border sticky top-0 z-30 flex-shrink-0">

      {/* Left: page title + greeting */}
      <div className="flex items-center gap-3 min-w-0">
        <h1 className="text-xl font-display text-text font-semibold tracking-tight truncate">{title}</h1>
        <div className="hidden lg:block h-4 w-px bg-border flex-shrink-0" />
        <span className="hidden lg:flex items-center gap-2 text-xs text-text-secondary font-medium whitespace-nowrap">
          <span className="text-accent">✦</span>
          Make today count · {greeting}
        </span>
      </div>

      {/* Right: quick actions + sync + search + avatar */}
      <div className="flex items-center gap-3 flex-shrink-0">

        {/* Quick-access routine buttons — icon-only from md, labeled from lg */}
        <div className="flex gap-2">
          <button
            onClick={() => navigate('/day?guided=morning')}
            title="Morning routine"
            className="text-xs px-2 lg:px-3 py-2 bg-warning/10 text-warning border border-warning/20 rounded-full hover:bg-warning/20 transition-all font-medium flex items-center gap-1"
          >
            <Sun size={12} />
            <span className="hidden lg:inline">Morning</span>
          </button>
          <button
            onClick={() => navigate('/day?guided=evening')}
            title="Evening review"
            className="text-xs px-2 lg:px-3 py-2 bg-info/10 text-info border border-info/20 rounded-full hover:bg-info/20 transition-all font-medium flex items-center gap-1"
          >
            <Moon size={12} />
            <span className="hidden lg:inline">Review</span>
          </button>
        </div>

        {/* Selected date chip — abbreviated from md, full from lg */}
        <div className="flex items-center gap-2 text-xs text-text-muted font-medium bg-surface px-2 lg:px-3 py-2 rounded-lg border border-border whitespace-nowrap">
          <span className="w-1.5 h-1.5 rounded-full bg-accent inline-block flex-shrink-0" />
          <span className="hidden lg:inline">{displayDate(selectedDate, 'EEEE, MMM d')}</span>
          <span className="lg:hidden">{displayDate(selectedDate, 'MMM d')}</span>
        </div>

        {/* Sync status indicator */}
        {hasSyncIssue && <SyncStatusDot />}

        {/* Notification center */}
        <ErrorBoundary inline>
          <NotificationCenter />
        </ErrorBoundary>

        {/* Search button */}
        <button
          onClick={() => navigate('/search')}
          className="w-8 h-8 flex items-center justify-center text-text-secondary hover:text-text transition-colors rounded-lg hover:bg-surface-2"
          aria-label="Search"
          title="Search workspace (Cmd+K)"
        >
          <Search size={17} />
        </button>

        {/* Contextual add — triggers the current page's add modal */}
        {ROUTES_WITH_ADD_ACTION.has(location.pathname) && (
          <button
            onClick={() => useAppStore.getState().triggerHeaderAdd()}
            className="w-8 h-8 flex items-center justify-center bg-accent/10 text-accent hover:bg-accent/20 transition-colors rounded-lg border border-accent/20"
            aria-label="Add item"
            title="Add item"
          >
            <Plus size={17} />
          </button>
        )}

        {/* Quick capture — always available, opens inbox modal */}
        <button
          onClick={() => setQuickCaptureOpen(true)}
          className="w-8 h-8 flex items-center justify-center text-text-secondary hover:text-text transition-colors rounded-lg hover:bg-surface-2"
          aria-label="Quick capture (inbox)"
          title="Quick capture to inbox"
        >
          <Zap size={16} />
        </button>

        {/* Avatar + dropdown */}
        <div className="relative">
          <button
            onClick={() => setMenuOpen(v => !v)}
            className="relative w-8 h-8 rounded-full bg-accent/20 border border-accent/40 flex items-center justify-center text-accent text-xs font-semibold hover:bg-accent/30 transition-colors"
            aria-label="Account menu"
          >
            {initials}
            {!isRecoveryVerified && (
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-warning ring-2 ring-bg animate-pulse" />
            )}
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-10 z-50 w-56 bg-surface border border-border rounded-xl shadow-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-border">
                  <p className="text-sm text-text font-medium truncate">{displayName}</p>
                  <p className="text-xs text-text-muted truncate">{profile?.timezone}</p>
                </div>
                {!isRecoveryVerified && (
                  <NavLink
                    to="/settings"
                    onClick={() => setMenuOpen(false)}
                    className="block px-3 py-2 mx-2 my-1.5 bg-warning/10 border border-warning/25 rounded-lg text-xs text-warning hover:bg-warning/20 transition-colors"
                  >
                    <p className="font-bold">⚠️ Backup Recovery Key</p>
                    <p className="text-[10px] text-text-muted mt-0.5">Protect your account</p>
                  </NavLink>
                )}
                <nav className="py-1">
                  {secondaryNav.map(({ to, icon: Icon, label }) => (
                    <NavLink key={to} to={to} onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-text-secondary hover:text-text hover:bg-surface-2 transition-colors">
                      <Icon size={15} />
                      {label}
                    </NavLink>
                  ))}
                  <div className="border-t border-border my-1" />
                  <NavLink to="/profile" onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-text-secondary hover:text-text hover:bg-surface-2 transition-colors">
                    <User size={15} />
                    Profile
                  </NavLink>
                  <NavLink to="/settings" onClick={() => setMenuOpen(false)}
                    className="flex items-center justify-between px-4 py-2.5 text-sm text-text-secondary hover:text-text hover:bg-surface-2 transition-colors">
                    <div className="flex items-center gap-3">
                      <Settings size={15} />
                      Settings
                    </div>
                    {!isRecoveryVerified && (
                      <span className="w-2 h-2 rounded-full bg-warning animate-pulse" />
                    )}
                  </NavLink>
                  <button
                    onClick={() => { signOut(); setMenuOpen(false) }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-danger hover:bg-danger/10 transition-colors"
                  >
                    <LogOut size={15} />
                    Sign Out
                  </button>
                </nav>
              </div>
            </>
          )}
        </div>
      </div>
      <QuickCaptureModal open={quickCaptureOpen} onOpenChange={setQuickCaptureOpen} />
    </header>
  )
}
