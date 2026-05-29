import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, CheckSquare, DollarSign, Target, BookOpen,
  CalendarDays, Inbox, FileText, Search, Settings, LogOut
} from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useAppStore } from '../../store/useAppStore'
import { displayDate } from '../../lib/dateUtils'
import { SyncStatusDot } from '../SyncStatusDot'
import clsx from 'clsx'

const navGroups = [
  {
    title: 'Core',
    items: [
      { to: '/',        icon: LayoutDashboard, label: 'Home'    },
      { to: '/tasks',   icon: CheckSquare,     label: 'Tasks'   },
      { to: '/finance', icon: DollarSign,      label: 'Finance' },
      { to: '/goals',   icon: Target,          label: 'Goals'   },
      { to: '/books',   icon: BookOpen,        label: 'Books'   },
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
  const { selectedDate } = useAppStore()

  const displayName = profile?.display_name || 'You'
  const initials = displayName.slice(0, 2).toUpperCase()

  return (
    <aside className="hidden md:flex flex-col w-16 lg:w-60 h-screen sticky top-0 bg-surface border-r border-border flex-shrink-0 transition-all duration-300 z-40">
      {/* Brand header */}
      <div className="h-16 flex items-center px-4 lg:px-6 border-b border-border justify-center lg:justify-between">
        <div className="flex flex-col leading-tight hidden lg:flex">
          <span className="text-[10px] text-text-muted font-body uppercase tracking-widest">Life OS</span>
          <span className="text-sm font-semibold text-text">Workspace</span>
        </div>
        <div className="relative flex items-center justify-center lg:block">
          <input 
            type="date"
            value={selectedDate}
            onChange={(e) => useAppStore.getState().setSelectedDate(e.target.value)}
            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
          />
          <span className="text-xs text-text-secondary hover:text-accent font-medium transition-colors flex items-center gap-1 cursor-pointer">
            <span className="lg:inline hidden">{displayDate(selectedDate, 'MMM d')}</span>
            <span className="lg:hidden">📅</span>
          </span>
        </div>
      </div>

      {/* Nav List */}
      <div className="flex-1 py-6 overflow-y-auto px-3 space-y-6">
        {navGroups.map((group, groupIdx) => (
          <div key={group.title} className="space-y-1">
            <p className="text-[10px] font-semibold text-text-muted uppercase tracking-widest px-3 hidden lg:block">
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
                      'sidebar-item group relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200',
                      isActive 
                        ? 'bg-accent/10 text-accent font-medium' 
                        : 'text-text-secondary hover:text-text hover:bg-surface-2'
                    )
                  }
                  title={label}
                >
                  <Icon size={18} />
                  <span className="lg:block hidden text-sm transition-opacity duration-300">{label}</span>
                  {/* Mini badge / label tooltip on hover for md: (collapsed) state */}
                  <span className="lg:hidden absolute left-14 bg-surface border border-border text-text text-xs rounded-md px-2 py-1 opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-200 shadow-md whitespace-nowrap z-50">
                    {label}
                  </span>
                </NavLink>
              ))}
            </nav>
            {groupIdx < navGroups.length - 1 && (
              <div className="border-t border-border/40 my-3 hidden lg:block" />
            )}
          </div>
        ))}

        {/* Global Utilities group for Collapsed Sidebar */}
        <div className="border-t border-border/40 pt-4 space-y-1">
          <NavLink
            to="/search"
            className={({ isActive }) =>
              clsx(
                'sidebar-item group relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200',
                isActive 
                  ? 'bg-accent/10 text-accent font-medium' 
                  : 'text-text-secondary hover:text-text hover:bg-surface-2'
              )
            }
            title="Search"
          >
            <Search size={18} />
            <span className="lg:block hidden text-sm">Search</span>
            <span className="lg:hidden absolute left-14 bg-surface border border-border text-text text-xs rounded-md px-2 py-1 opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-200 shadow-md whitespace-nowrap z-50">
              Search
            </span>
          </NavLink>
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              clsx(
                'sidebar-item group relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200',
                isActive 
                  ? 'bg-accent/10 text-accent font-medium' 
                  : 'text-text-secondary hover:text-text hover:bg-surface-2'
              )
            }
            title="Settings"
          >
            <Settings size={18} />
            <span className="lg:block hidden text-sm">Settings</span>
            <span className="lg:hidden absolute left-14 bg-surface border border-border text-text text-xs rounded-md px-2 py-1 opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-200 shadow-md whitespace-nowrap z-50">
              Settings
            </span>
          </NavLink>
        </div>
      </div>

      {/* Footer Profile Area */}
      <div className="p-4 border-t border-border bg-surface-2/30 flex items-center justify-between gap-3 lg:flex-row flex-col">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-accent/20 border border-accent/40 flex items-center justify-center text-accent text-xs font-semibold flex-shrink-0">
            {initials}
          </div>
          <div className="hidden lg:flex flex-col min-w-0">
            <span className="text-xs text-text font-medium truncate w-28">{displayName}</span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <SyncStatusDot />
              <span className="text-[10px] text-text-muted truncate">Synced</span>
            </div>
          </div>
        </div>
        <button
          onClick={() => signOut()}
          className="p-1.5 rounded-lg text-text-muted hover:text-danger hover:bg-danger/10 transition-colors"
          title="Sign Out"
        >
          <LogOut size={16} />
        </button>
      </div>
    </aside>
  )
}
