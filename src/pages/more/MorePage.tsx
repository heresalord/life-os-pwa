import { useNavigate } from 'react-router-dom'
import {
  Sun, Moon, Settings, LogOut,
  LayoutDashboard, CheckSquare, DollarSign, Target, BookOpen,
  CalendarDays, Inbox, FileText, Search, Heart, Briefcase,
  ChevronRight,
} from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useAppStore } from '../../store/useAppStore'
import { useTranslation } from '../../i18n'

// All modules — order determines display order in the grid
const ALL_MODULES = [
  { key: 'home',     to: '/',         icon: LayoutDashboard, label: 'Home'      },
  { key: 'day',      to: '/day',      icon: Heart,           label: 'Daily Log' },
  { key: 'tasks',    to: '/tasks',    icon: CheckSquare,     label: 'Tasks'     },
  { key: 'finance',  to: '/finance',  icon: DollarSign,      label: 'Finance'   },
  { key: 'goals',    to: '/goals',    icon: Target,          label: 'Goals'     },
  { key: 'projects', to: '/projects', icon: Briefcase,       label: 'Projects'  },
  { key: 'books',    to: '/books',    icon: BookOpen,        label: 'Books'     },
  { key: 'agenda',   to: '/agenda',   icon: CalendarDays,    label: 'Agenda'    },
  { key: 'inbox',    to: '/inbox',    icon: Inbox,           label: 'Inbox'     },
  { key: 'notes',    to: '/notes',    icon: FileText,        label: 'Notes'     },
  { key: 'search',   to: '/search',   icon: Search,          label: 'Search'    },
]

export function MorePage() {
  const navigate = useNavigate()
  const { profile, signOut } = useAuth()
  const { navItems } = useAppStore()
  const { t } = useTranslation()

  const displayName = profile?.display_name || 'You'
  const initials    = displayName.slice(0, 2).toUpperCase()

  // Split into pinned (in bottom nav) and others
  const pinned = ALL_MODULES.filter(m => navItems.includes(m.key) || m.key === 'home')
  const others = ALL_MODULES.filter(m => !navItems.includes(m.key) && m.key !== 'home')

  const go = (to: string) => navigate(to)

  return (
    <div className="space-y-6 max-w-lg mx-auto pb-12">

      {/* Profile card */}
      <button
        onClick={() => go('/profile')}
        className="w-full flex items-center gap-4 p-4 bg-surface border border-border rounded-2xl hover:bg-surface-2 transition-colors text-left"
      >
        <div className="w-12 h-12 rounded-full bg-accent/20 border-2 border-accent/40 flex items-center justify-center text-accent text-base font-bold flex-shrink-0">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-text truncate">{displayName}</p>
          <p className="text-xs text-text-muted truncate">{profile?.timezone}</p>
        </div>
        <ChevronRight size={16} className="text-text-muted flex-shrink-0" />
      </button>

      {/* Routines quick launch */}
      <section className="space-y-2">
        <h2 className="text-[11px] font-bold text-text-muted uppercase tracking-widest px-1">
          {t('more.routines', 'Routines')}
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => go('/day?guided=morning')}
            className="flex items-center gap-3 p-4 bg-warning/10 border border-warning/20 rounded-2xl hover:bg-warning/20 transition-colors text-left"
          >
            <Sun size={20} className="text-warning flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-text">{t('more.morning', 'Morning')}</p>
              <p className="text-xs text-text-muted">{t('more.guided_mode', 'Guided mode')}</p>
            </div>
          </button>
          <button
            onClick={() => go('/day?guided=evening')}
            className="flex items-center gap-3 p-4 bg-info/10 border border-info/20 rounded-2xl hover:bg-info/20 transition-colors text-left"
          >
            <Moon size={20} className="text-info flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-text">{t('more.evening', 'Evening')}</p>
              <p className="text-xs text-text-muted">{t('more.guided_mode', 'Guided mode')}</p>
            </div>
          </button>
        </div>
      </section>

      {/* All modules */}
      {others.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-[11px] font-bold text-text-muted uppercase tracking-widest px-1">
            {t('more.more_modules', 'More Modules')}
          </h2>
          <div className="grid grid-cols-3 gap-3">
            {others.map(({ key, to, icon: Icon, label }) => (
              <button
                key={key}
                onClick={() => go(to)}
                className="flex flex-col items-center gap-2 p-4 bg-surface border border-border rounded-2xl hover:bg-surface-2 hover:border-accent/30 transition-all text-center"
              >
                <Icon size={22} className="text-text-secondary" />
                <span className="text-xs font-medium text-text-muted">
                  {t(`nav.${key}`, label)}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Nav modules — already pinned */}
      <section className="space-y-2">
        <h2 className="text-[11px] font-bold text-text-muted uppercase tracking-widest px-1">
          {t('more.pinned', 'Pinned in Nav')}
        </h2>
        <div className="grid grid-cols-3 gap-3">
          {pinned.map(({ key, to, icon: Icon, label }) => (
            <button
              key={key}
              onClick={() => go(to)}
              className="flex flex-col items-center gap-2 p-4 bg-accent/5 border border-accent/20 rounded-2xl hover:bg-accent/10 transition-all text-center"
            >
              <Icon size={22} className="text-accent" />
              <span className="text-xs font-medium text-accent">
                {t(`nav.${key}`, label)}
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* Settings + Sign out */}
      <section className="space-y-2">
        <h2 className="text-[11px] font-bold text-text-muted uppercase tracking-widest px-1">
          {t('more.account', 'Account')}
        </h2>
        <div className="bg-surface border border-border rounded-2xl overflow-hidden divide-y divide-border">
          <button
            onClick={() => go('/settings')}
            className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-surface-2 transition-colors text-left"
          >
            <Settings size={17} className="text-text-secondary flex-shrink-0" />
            <span className="text-sm font-medium text-text flex-1">{t('settings.title', 'Settings')}</span>
            <ChevronRight size={15} className="text-text-muted" />
          </button>
          <button
            onClick={async () => {
              if (window.confirm('Sign out?')) await signOut()
            }}
            className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-danger/5 transition-colors text-left"
          >
            <LogOut size={17} className="text-danger flex-shrink-0" />
            <span className="text-sm font-medium text-danger flex-1">{t('more.sign_out', 'Sign Out')}</span>
          </button>
        </div>
      </section>
    </div>
  )
}
