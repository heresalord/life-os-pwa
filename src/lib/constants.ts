import {
  Heart, CheckSquare, DollarSign, Target, Briefcase,
  BookOpen, CalendarDays, Inbox, FileText, Search
} from 'lucide-react'

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

/**
 * Routes whose module has a primary "add new" action, surfaced as a single
 * header icon (next to Search) instead of a per-module floating button or
 * inline dashed button. Extend as each module migrates.
 */
export const ROUTES_WITH_ADD_ACTION = new Set(['/tasks', '/finance', '/notes', '/goals', '/books'])
