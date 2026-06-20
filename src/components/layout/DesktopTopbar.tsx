import { useLocation, useNavigate } from 'react-router-dom'
import { Sun, Moon, Search, Settings, LogOut } from 'lucide-react'
import { useState } from 'react'
import { useAppStore } from '../../store/useAppStore'
import { useAuth } from '../../hooks/useAuth'
import { displayDate } from '../../lib/dateUtils'
import { SyncStatusDot } from '../SyncStatusDot'
import { NavLink } from 'react-router-dom'
import { NotificationCenter } from '../notifications/NotificationCenter'
import { CalendarDays, Inbox, FileText } from 'lucide-react'
import { ErrorBoundary } from '../ErrorBoundary'

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

  const title = pathTitleMap[location.pathname] || 'Life OS'

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Morning' : hour < 18 ? 'Afternoon' : 'Evening'

  const displayName = profile?.display_name || 'You'
  const initials = displayName.slice(0, 2).toUpperCase()

  return (
    <header className="hidden md:flex h-16 items-center justify-between px-6 bg-bg border-b border-border sticky top-0 z-30 flex-shrink-0">

      {/* Left: page title + greeting */}
      <div className="flex items-center gap-3 min-w-0">
        <h1 className="text-xl font-display text-text font-semibold tracking-tight truncate">{title}</h1>
        <div className="hidden lg:block h-4 w-px bg-border flex-shrink-0" />
        <span className="hidden lg:flex items-center gap-1.5 text-xs text-text-secondary font-medium whitespace-nowrap">
          <span className="text-accent">✦</span>
          Make today count · {greeting}
        </span>
      </div>

      {/* Right: quick actions + sync + search + avatar */}
      <div className="flex items-center gap-3 flex-shrink-0">

        {/* Quick-access routine buttons */}
        <div className="hidden lg:flex gap-2">
          <button
            onClick={() => navigate('/day?guided=morning')}
            className="text-xs px-3 py-1.5 bg-warning/10 text-warning border border-warning/20 rounded-full hover:bg-warning/20 transition-all font-medium flex items-center gap-1"
          >
            <Sun size={12} />
            Morning
          </button>
          <button
            onClick={() => navigate('/day?guided=evening')}
            className="text-xs px-3 py-1.5 bg-info/10 text-info border border-info/20 rounded-full hover:bg-info/20 transition-all font-medium flex items-center gap-1"
          >
            <Moon size={12} />
            Review
          </button>
        </div>

        {/* Selected date chip */}
        <div className="hidden lg:flex items-center gap-1.5 text-xs text-text-muted font-medium bg-surface px-3 py-1.5 rounded-lg border border-border whitespace-nowrap">
          <CalendarDays size={14} /> <span className="text-text">{displayDate(selectedDate, 'EEE, MMM d')}</span>
        </div>

        {/* Sync status */}
        <SyncStatusDot />

        {/* Notifications */}
        <ErrorBoundary inline>
          <NotificationCenter />
        </ErrorBoundary>

        {/* Search */}
        <button
          onClick={() => navigate('/search')}
          className="w-8 h-8 flex items-center justify-center text-text-secondary hover:text-text transition-colors rounded-lg hover:bg-surface-2"
          aria-label="Search"
        >
          <Search size={17} />
        </button>

        {/* Avatar + dropdown */}
        <div className="relative">
          <button
            onClick={() => setMenuOpen(v => !v)}
            className="w-8 h-8 rounded-full bg-accent/20 border border-accent/40 flex items-center justify-center text-accent text-xs font-semibold hover:bg-accent/30 transition-colors"
            aria-label="Account menu"
          >
            {initials}
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-10 z-50 w-52 bg-surface border border-border rounded-xl shadow-xl overflow-hidden">
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
                  <button
                    onClick={() => { signOut(); setMenuOpen(false) }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-danger hover:bg-danger/10 transition-colors"
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
    </header>
  )
}
