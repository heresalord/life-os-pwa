import { useLocation, useNavigate } from 'react-router-dom'
import { Sun, Moon, Sparkles } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import { displayDate } from '../../lib/dateUtils'

const pathTitleMap: Record<string, string> = {
  '/': 'Dashboard',
  '/tasks': 'Tasks & Focus',
  '/finance': 'Finance & Budget',
  '/goals': 'Life Goals',
  '/books': 'Reading List',
  '/agenda': 'Agenda & Schedule',
  '/inbox': 'Inbox & Quick Capture',
  '/notes': 'Notes Journal',
  '/search': 'Search Workspace',
  '/settings': 'Settings',
  '/morning': 'Morning Ritual',
  '/review': 'Weekly Review',
}

export function DesktopTopbar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { selectedDate } = useAppStore()

  const title = pathTitleMap[location.pathname] || 'Life OS'

  // Get current hour for context
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Morning' : hour < 18 ? 'Afternoon' : 'Evening'

  return (
    <header className="hidden md:flex h-16 items-center justify-between px-6 bg-bg/85 backdrop-blur-md border-b border-border sticky top-0 z-30">
      {/* Page Title & Context */}
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-display text-text font-semibold tracking-tight">{title}</h1>
        <div className="hidden lg:flex h-4 w-px bg-border" />
        <span className="hidden lg:inline text-xs text-text-secondary font-medium flex items-center gap-1.5">
          <Sparkles size={12} className="text-accent" />
          Make today count • {greeting}
        </span>
      </div>

      {/* Center/Right widgets */}
      <div className="flex items-center gap-4">
        {/* Rapid Actions */}
        <div className="flex gap-2 mr-2">
          <button
            onClick={() => navigate('/morning')}
            className="text-xs px-3.5 py-1.5 bg-warning/10 text-warning border border-warning/20 rounded-full hover:bg-warning/20 transition-all font-medium flex items-center gap-1"
          >
            <Sun size={12} />
            Morning
          </button>
          <button
            onClick={() => navigate('/review')}
            className="text-xs px-3.5 py-1.5 bg-info/10 text-info border border-info/20 rounded-full hover:bg-info/20 transition-all font-medium flex items-center gap-1"
          >
            <Moon size={12} />
            Review
          </button>
        </div>

        {/* Selected Date indicator */}
        <div className="text-xs text-text-muted font-medium bg-surface px-3 py-1.5 rounded-lg border border-border">
          📅 Selected: <span className="text-text">{displayDate(selectedDate, 'EEEE, MMM d')}</span>
        </div>
      </div>
    </header>
  )
}
