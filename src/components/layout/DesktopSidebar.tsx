import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, CheckSquare, DollarSign, Target, BookOpen,
  CalendarDays, Inbox, FileText, Search, Settings, LogOut, Heart,
  Briefcase, PanelLeftClose, PanelLeftOpen
} from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useAppStore } from '../../store/useAppStore'
import { useRecoveryKeyStatus } from '../../hooks/useRecoveryKeyStatus'
import { displayDate } from '../../lib/dateUtils'
import { SyncStatusDot } from '../SyncStatusDot'
import clsx from 'clsx'

const navGroups = [
  {
    title: 'Core',
    items: [
      { to: '/',        icon: LayoutDashboard, label: 'Home'      },
      { to: '/day',     icon: Heart,           label: 'Daily Log' },
      { to: '/tasks',   icon: CheckSquare,     label: 'Tasks'     },
      { to: '/finance', icon: DollarSign,      label: 'Finance'   },
      { to: '/goals',   icon: Target,          label: 'Goals'     },
      { to: '/projects',icon: Briefcase,       label: 'Projects'  },
      { to: '/books',   icon: BookOpen,        label: 'Books'     },
    ]
  },
  {
    title: 'Focus',
    items: [
      { to: '/agenda', icon: CalendarDays, label: 'Agenda' },
      { to: '/inbox',  icon: Inbox,        label: 'Inbox'  },
      { to: '/notes',  icon: FileText,     label: 'Notes'  },
    ]
  }
]

export function DesktopSidebar() {
  const { profile, signOut } = useAuth()
  const { selectedDate, sidebarPinnedOpen, setSidebarPinnedOpen } = useAppStore()

  const displayName = profile?.display_name || 'You'
  const initials = displayName.slice(0, 2).toUpperCase()

  // Whether labels/full-width content should show at the md breakpoint too,
  // not just lg. At lg+ this is always effectively true regardless of the flag.
  const pinned = sidebarPinnedOpen
  const labelClass = pinned ? 'block' : 'hidden lg:block'
  const flexLabelClass = pinned ? 'flex' : 'hidden lg:flex'
  const inlineLabelClass = pinned ? 'inline' : 'hidden lg:inline'
  const tooltipClass = pinned ? 'lg:hidden hidden' : 'lg:hidden'

  const { isVerified: isRecoveryVerified } = useRecoveryKeyStatus()

  return (
    <aside className={clsx(
      'hidden md:flex flex-col h-screen sticky top-0 bg-surface border-r border-border flex-shrink-0 transition-all duration-300 z-40',
      pinned ? 'w-60' : 'w-16 lg:w-60'
    )}>
      {/* Brand header */}
      <div className={clsx('h-16 flex items-center px-4 border-b border-border', pinned ? 'lg:px-6 justify-between' : 'lg:px-6 justify-center lg:justify-between')}>
        <div className={clsx('flex-col leading-tight', flexLabelClass)}>
          <span className="text-[10px] text-text-muted font-body uppercase tracking-widest">Life OS</span>
          <span className="text-sm font-semibold text-text">Workspace</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative flex items-center justify-center lg:block">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => useAppStore.getState().setSelectedDate(e.target.value)}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
            />
            <span className="text-xs text-text-secondary hover:text-accent font-medium transition-colors flex items-center gap-1 cursor-pointer">
              <span className={inlineLabelClass}>{displayDate(selectedDate, 'MMM d')}</span>
              <span className={pinned ? 'hidden' : 'lg:hidden'}><CalendarDays size={14} /></span>
            </span>
          </div>
          {/* Pin toggle — only meaningful at md (below lg, the sidebar is already fully expanded) */}
          <button
            onClick={() => setSidebarPinnedOpen(!pinned)}
            title={pinned ? 'Collapse sidebar' : 'Keep sidebar expanded'}
            className="lg:hidden p-2 rounded-lg text-text-muted hover:text-text hover:bg-surface-2 transition-colors flex-shrink-0"
          >
            {pinned ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
          </button>
        </div>
      </div>

      {/* Nav List */}
      <div className="flex-1 py-6 overflow-y-auto px-3 space-y-6">
        {navGroups.map((group, groupIdx) => (
          <div key={group.title} className="space-y-1">
            <p className={clsx('text-[10px] font-semibold text-text-muted uppercase tracking-widest px-3', labelClass)}>
              {group.title}
            </p>
            <nav className="space-y-1">
              {group.items.map(({ to, icon: Icon, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === '/'}
                  className={({ isActive }) =>
                    clsx(
                      'sidebar-item group relative flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-200',
                      isActive 
                        ? 'bg-accent/10 text-accent font-medium' 
                        : 'text-text-secondary hover:text-text hover:bg-surface-2'
                    )
                  }
                  title={label}
                >
                  <Icon size={18} />
                  <span className={clsx(labelClass, 'text-sm transition-opacity duration-300')}>{label}</span>
                  {/* Mini badge / label tooltip on hover for icon-only state */}
                  <span className={clsx(tooltipClass, 'absolute left-14 bg-surface border border-border text-text text-xs rounded-md px-2 py-1 opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-200 shadow-md whitespace-nowrap z-50')}>
                    {label}
                  </span>
                </NavLink>
              ))}
            </nav>
            {groupIdx < navGroups.length - 1 && (
              <div className={clsx('border-t border-border/40 my-3', labelClass)} />
            )}
          </div>
        ))}

        {/* Global Utilities group for Collapsed Sidebar */}
        <div className="border-t border-border/40 pt-4 space-y-1">
          <NavLink
            to="/search"
            className={({ isActive }) =>
              clsx(
                'sidebar-item group relative flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-200',
                isActive 
                  ? 'bg-accent/10 text-accent font-medium' 
                  : 'text-text-secondary hover:text-text hover:bg-surface-2'
              )
            }
            title="Search"
          >
            <Search size={18} />
            <span className={clsx(labelClass, 'text-sm')}>Search</span>
            <span className={clsx(tooltipClass, 'absolute left-14 bg-surface border border-border text-text text-xs rounded-md px-2 py-1 opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-200 shadow-md whitespace-nowrap z-50')}>
              Search
            </span>
          </NavLink>
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              clsx(
                'sidebar-item group relative flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-200',
                isActive 
                  ? 'bg-accent/10 text-accent font-medium' 
                  : 'text-text-secondary hover:text-text hover:bg-surface-2'
              )
            }
            title="Settings"
          >
            <div className="relative">
              <Settings size={18} />
              {!isRecoveryVerified && (
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-warning animate-pulse" />
              )}
            </div>
            <span className={clsx(labelClass, 'text-sm')}>Settings</span>
            {!isRecoveryVerified && (
              <span className={clsx(labelClass, 'ml-auto text-[9px] bg-warning/15 text-warning font-bold px-2 py-0.5 rounded-full')}>
                !
              </span>
            )}
            <span className={clsx(tooltipClass, 'absolute left-14 bg-surface border border-border text-text text-xs rounded-md px-2 py-1 opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-200 shadow-md whitespace-nowrap z-50')}>
              Settings {!isRecoveryVerified ? '(Backup Key)' : ''}
            </span>
          </NavLink>
        </div>
      </div>

      {/* Footer Profile Area */}
      <div className={clsx('p-4 border-t border-border bg-surface-2/30 flex items-center justify-between gap-3 flex-col', pinned ? 'lg:flex-row' : 'lg:flex-row')}>
        <NavLink to="/profile" className="flex items-center gap-3 group/profile-footer flex-1 min-w-0">
          <div className="relative w-8 h-8 rounded-full bg-accent/20 border border-accent/40 flex items-center justify-center text-accent text-xs font-semibold flex-shrink-0 group-hover/profile-footer:bg-accent/30 group-hover/profile-footer:border-accent/60 transition-colors">
            {initials}
            {!isRecoveryVerified && (
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-warning ring-2 ring-bg animate-pulse" />
            )}
          </div>
          <div className={clsx(flexLabelClass, 'flex-col min-w-0')}>
            <span className="text-xs text-text font-medium truncate w-28 group-hover/profile-footer:text-accent transition-colors">{displayName}</span>
            <div className="flex items-center gap-2 mt-0.5">
              <SyncStatusDot />
              <span className="text-[10px] text-text-muted truncate">Synced</span>
            </div>
          </div>
        </NavLink>
        <button
          onClick={() => signOut()}
          className="p-2 rounded-lg text-text-muted hover:text-danger hover:bg-danger/10 transition-colors"
          title="Sign Out"
        >
          <LogOut size={16} />
        </button>
      </div>
    </aside>
  )
}
