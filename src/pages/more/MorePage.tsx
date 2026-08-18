import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Sun, Moon, Settings, LogOut,
  LayoutDashboard, CheckSquare, DollarSign, Target, BookOpen,
  CalendarDays, Inbox, FileText, Search, Heart, Briefcase,
  ChevronRight, Sparkles,
} from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useAppStore } from '../../store/useAppStore'
import { useTranslation } from '../../i18n'
import { WeeklyRecapModal } from '../../components/dashboard/WeeklyRecapModal'
import { ConfirmDialog } from '../../components/ConfirmDialog'

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
  const [recapOpen, setRecapOpen] = useState(false)

  const displayName = profile?.display_name || 'You'
  const initials    = displayName.slice(0, 2).toUpperCase()
  const [signOutOpen, setSignOutOpen] = useState(false)

  // Split into pinned (in bottom nav) and others
  const pinned = ALL_MODULES.filter(m => navItems.includes(m.key) || m.key === 'home')
  const others = ALL_MODULES.filter(m => !navItems.includes(m.key) && m.key !== 'home')

  const go = (to: string) => navigate(to)

  return (
    <div className="space-y-6 max-w-lg mx-auto pb-12">

      {/* Profile card */}
      <button
        onClick={() => go('/profile')}
        className="w-full flex items-center gap-4 p-4 bg-surface border border-border rounded-2xl hover:bg-surface-2 press-row transition-colors text-left"
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

      {/* Weekly Recap */}
      <button
        onClick={() => setRecapOpen(true)}
        className="w-full flex items-center gap-4 p-4 bg-gradient-to-r from-violet-500/10 to-blue-500/10 border border-violet-500/20 rounded-2xl hover:from-violet-500/20 hover:to-blue-500/20 press-row transition-all text-left"
      >
        <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center flex-shrink-0">
          <Sparkles size={18} className="text-violet-400" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-text">Weekly Recap</p>
          <p className="text-xs text-text-muted">Review last week's highlights</p>
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
            className="flex items-center gap-3 p-4 bg-warning/10 border border-warning/20 rounded-2xl hover:bg-warning/20 press-row transition-colors text-left"
          >
            <Sun size={20} className="text-warning flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-text">{t('more.morning', 'Morning')}</p>
              <p className="text-xs text-text-muted">{t('more.guided_mode', 'Guided mode')}</p>
            </div>
          </button>
          <button
            onClick={() => go('/day?guided=evening')}
            className="flex items-center gap-3 p-4 bg-info/10 border border-info/20 rounded-2xl hover:bg-info/20 press-row transition-colors text-left"
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
          <div className="bg-surface border border-border rounded-2xl overflow-hidden divide-y divide-border">
            {others.map(({ key, to, icon: Icon, label }) => (
              <button
                key={key}
                onClick={() => go(to)}
                className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-surface-2 press-row transition-colors text-left"
              >
                <div className="w-8 h-8 rounded-xl bg-surface-2 border border-border flex items-center justify-center flex-shrink-0">
                  <Icon size={16} className="text-text-secondary" />
                </div>
                <span className="text-sm font-medium text-text flex-1">{t(`nav.${key}`, label)}</span>
                <ChevronRight size={15} className="text-text-muted" />
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
        <div className="bg-surface border border-accent/20 rounded-2xl overflow-hidden divide-y divide-border">
          {pinned.map(({ key, to, icon: Icon, label }) => (
            <button
              key={key}
              onClick={() => go(to)}
              className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-accent/5 press-row transition-colors text-left"
            >
              <div className="w-8 h-8 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center flex-shrink-0">
                <Icon size={16} className="text-accent" />
              </div>
              <span className="text-sm font-medium text-text flex-1">{t(`nav.${key}`, label)}</span>
              <ChevronRight size={15} className="text-accent/60" />
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
            className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-surface-2 press-row transition-colors text-left"
          >
            <Settings size={17} className="text-text-secondary flex-shrink-0" />
            <span className="text-sm font-medium text-text flex-1">{t('settings.title', 'Settings')}</span>
            <ChevronRight size={15} className="text-text-muted" />
          </button>
          <button
            onClick={() => setSignOutOpen(true)}
            className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-danger/5 press-row transition-colors text-left"
          >
            <LogOut size={17} className="text-danger flex-shrink-0" />
            <span className="text-sm font-medium text-danger flex-1">{t('more.sign_out', 'Sign Out')}</span>
          </button>
        </div>
      </section>
      {recapOpen && <WeeklyRecapModal forceOpen onClose={() => setRecapOpen(false)} />}
      <ConfirmDialog
        open={signOutOpen}
        onOpenChange={setSignOutOpen}
        title="Sign out?"
        description="You'll be signed out of your account. Your data is safely synced."
        confirmLabel="Sign Out"
        onConfirm={signOut}
      />
    </div>
  )
}
