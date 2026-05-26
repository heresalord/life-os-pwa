import React from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, CheckSquare, DollarSign, Target, BookOpen,
  CalendarDays, Inbox, FileText, Search, Settings, X
} from 'lucide-react'
import { SyncStatusDot } from '../SyncStatusDot'
import { useAuth } from '../../hooks/useAuth'
import { useAppStore } from '../../store/useAppStore'
import { displayDate } from '../../lib/dateUtils'
import { InboxFAB } from '../inbox/InboxFAB'
import clsx from 'clsx'

const primaryNav = [
  { to: '/',        icon: LayoutDashboard, label: 'Home'    },
  { to: '/tasks',   icon: CheckSquare,     label: 'Tasks'   },
  { to: '/finance', icon: DollarSign,      label: 'Finance' },
  { to: '/goals',   icon: Target,          label: 'Goals'   },
  { to: '/books',   icon: BookOpen,        label: 'Books'   },
]

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
  const { selectedDate, timezone } = useAppStore()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = React.useState(false)

  const today = new Date().toLocaleDateString('en-CA', { timeZone: timezone })
  const isTimeTravel = selectedDate !== today

  const displayName = profile?.display_name || 'You'
  const initials = displayName.slice(0, 2).toUpperCase()

  return (
    <div className="flex flex-col min-h-screen bg-bg">
      <header className="sticky top-0 z-30 bg-bg/90 backdrop-blur-md border-b border-border">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex flex-col leading-tight">
            <span className="text-xs text-text-muted font-body uppercase tracking-widest">Life OS</span>
            <span className="text-sm text-text font-medium">
              {displayDate(selectedDate, 'EEE, MMM d')}
            </span>
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

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-4 pb-28">
        {children}
      </main>

      <InboxFAB />

      <nav
        className="fixed bottom-0 left-0 right-0 z-30 bg-surface/95 backdrop-blur-md border-t border-border"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="max-w-2xl mx-auto flex items-center justify-around h-16">
          {primaryNav.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
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
