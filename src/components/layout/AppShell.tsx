import React from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, CheckSquare, DollarSign, Target, BookOpen,
  CalendarDays, Inbox, FileText, Search, Clock, Heart,
  Briefcase, MoreHorizontal,
} from 'lucide-react'
import { SyncStatusDot } from '../SyncStatusDot'
import { useAuth } from '../../hooks/useAuth'
import { useAppStore } from '../../store/useAppStore'
import { displayDate } from '../../lib/dateUtils'
import { InboxFAB } from '../inbox/InboxFAB'
import { InstallBanner } from './InstallBanner'
import { DesktopSidebar } from './DesktopSidebar'
import { DesktopTopbar } from './DesktopTopbar'
import { NotificationCenter } from '../notifications/NotificationCenter'
import { useNavSync } from '../../hooks/useNavSync'
import { useWidgetSync } from '../../hooks/useWidgetSync'
import { useTranslation } from '../../i18n'
import { ErrorBoundary } from '../ErrorBoundary'
import clsx from 'clsx'

export const ALL_NAV_OPTIONS = [
  { key: 'day',      to: '/day',      icon: Heart,        label: 'Daily Log' },
  { key: 'tasks',    to: '/tasks',    icon: CheckSquare,  label: 'Tasks'     },
  { key: 'finance',  to: '/finance',  icon: DollarSign,   label: 'Finance'   },
  { key: 'goals',    to: '/goals',    icon: Target,       label: 'Goals'     },
  { key: 'projects', to: '/projects', icon: Briefcase,    label: 'Projects'  },
  { key: 'books',    to: '/books',    icon: BookOpen,     label: 'Books'     },
  { key: 'agenda',   to: '/agenda',   icon: CalendarDays, label: 'Agenda'    },
  { key: 'inbox',    to: '/inbox',    icon: Inbox,        label: 'Inbox'     },
  { key: 'notes',    to: '/notes',    icon: FileText,     label: 'Notes'     },
  { key: 'search',   to: '/search',   icon: Search,       label: 'Search'    },
]

const HOME_NAV = { key: 'home', to: '/', icon: LayoutDashboard, label: 'Home' }

interface AppShellProps { children: React.ReactNode }

export function AppShell({ children }: AppShellProps) {
  const { profile } = useAuth()
  const { selectedDate, timezone, navItems } = useAppStore()
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useTranslation()
  const [animKey, setAnimKey] = React.useState(location.pathname)

  useNavSync()
  useWidgetSync()

  const dynamicNav = [
    HOME_NAV,
    ...navItems
      .map(key => ALL_NAV_OPTIONS.find(o => o.key === key))
      .filter(Boolean) as typeof ALL_NAV_OPTIONS,
  ]

  React.useEffect(() => {
    setAnimKey(location.pathname)
  }, [location.pathname])

  const today = new Date().toLocaleDateString('en-CA', { timeZone: timezone })
  const isTimeTravel = selectedDate !== today

  const displayName = profile?.display_name || 'You'
  const initials = displayName.slice(0, 2).toUpperCase()

  // Translate nav label using JSON keys; fall back to the English label
  const navLabel = (key: string, fallback: string) =>
    t(`nav.${key}`, fallback)

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-bg">

      <DesktopSidebar />

      <div className="flex flex-col flex-1 min-w-0">

        {/* ── Mobile header ─────────────────────────────────────────────── */}
        <header
          className="md:hidden sticky top-0 z-30 bg-bg border-b border-border"
          style={{ paddingTop: 'env(safe-area-inset-top)' }}
        >
          <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">

            {/* Left: app name + date picker */}
            <div className="flex flex-col leading-tight relative group">
              <span className="text-xs text-text-muted font-body uppercase tracking-widest">Life OS</span>
              <div className="relative">
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => useAppStore.getState().setSelectedDate(e.target.value)}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                />
                <span className="text-sm text-text font-medium group-hover:text-accent transition-colors">
                  {displayDate(selectedDate, 'EEE, MMM d')}
                </span>
              </div>
            </div>

            {/* Right: actions */}
            <div className="flex items-center gap-2.5">
              <SyncStatusDot />

              <ErrorBoundary inline>
                <NotificationCenter />
              </ErrorBoundary>

              <button
                onClick={() => navigate('/search')}
                className="w-8 h-8 flex items-center justify-center text-text-secondary hover:text-text transition-colors"
                aria-label="Search"
              >
                <Search size={18} />
              </button>

              {/* Avatar → Profile */}
              <button
                onClick={() => navigate('/profile')}
                className="w-8 h-8 rounded-full bg-accent/20 border border-accent/40 flex items-center justify-center text-accent text-xs font-semibold hover:bg-accent/30 transition-colors"
                aria-label="Profile"
              >
                {initials}
              </button>

              {/* More → /more page */}
              <button
                onClick={() => navigate('/more')}
                className="w-8 h-8 flex items-center justify-center text-text-secondary hover:text-text transition-colors rounded-lg hover:bg-surface-2"
                aria-label="More"
              >
                <MoreHorizontal size={18} />
              </button>
            </div>
          </div>
        </header>

        <DesktopTopbar />

        {/* Time-travel banner */}
        {isTimeTravel && (
          <div className="bg-timetravel/15 border-b border-timetravel/30 px-4 py-2 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs text-timetravel font-medium">
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
          'flex-1 w-full px-4 py-4 pb-28 overflow-x-hidden',
          'max-w-2xl mx-auto',
          'md:max-w-none md:mx-0 md:pb-6 md:px-6 md:py-6',
        )}>
          <div key={animKey} className="page-enter">
            {children}
          </div>
        </main>
      </div>

      <div className="md:hidden">
        <InboxFAB />
      </div>

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
              className={({ isActive }) =>
                clsx(
                  'flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition-all',
                  isActive ? 'text-accent' : 'text-text-muted hover:text-text-secondary'
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={20} strokeWidth={isActive ? 2.5 : 1.75} />
                  <span className={clsx('text-[10px] font-medium', isActive ? 'text-accent' : '')}>
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
