import { useState } from 'react'
import { List, Calendar, Clock } from 'lucide-react'
import { ListTab } from './components/ListTab'
import { CalendarTab } from './components/CalendarTab'
import { TimeBlocksTab } from './components/TimeBlocksTab'
import clsx from 'clsx'

type View = 'list' | 'calendar' | 'timeblocks'

const VIEWS = [
  { id: 'list'       as View, label: 'List',        icon: List       },
  { id: 'calendar'   as View, label: 'Calendar',    icon: Calendar   },
  { id: 'timeblocks' as View, label: 'Time Blocks', icon: Clock      },
] as const

export function TasksPage() {
  const [view, setView] = useState<View>('list')

  return (
    <div className="space-y-4 lg:max-w-5xl">
      <header>
        <h1 className="text-2xl font-display text-text">Tasks</h1>
      </header>

      {/* View switcher - Grid with 3 columns matching Finance module tab layout */}
      <div className="grid grid-cols-3 gap-1 p-1 bg-surface-2 border border-border rounded-2xl">
        {VIEWS.map(v => {
          const Icon = v.icon
          const isActive = view === v.id
          return (
            <button
              key={v.id}
              onClick={() => setView(v.id)}
              className={clsx(
                'flex items-center justify-center gap-1 py-2 px-1 rounded-xl transition-all duration-200 font-medium w-full text-xs sm:text-sm',
                isActive
                  ? 'bg-surface text-text shadow-sm'
                  : 'text-text-muted hover:text-text-secondary'
              )}
            >
              <Icon size={16} strokeWidth={isActive ? 2.5 : 1.75} />
              {/* Label: always visible on sm+, only on active on mobile */}
              <span className={clsx(
                'text-xs sm:text-sm',
                isActive ? 'inline' : 'hidden sm:inline'
              )}>
                {v.label}
              </span>
            </button>
          )
        })}
      </div>

      {/* Active view */}
      <div className="min-h-[50vh] animate-in fade-in duration-200">
        {view === 'list'       && <ListTab />}
        {view === 'calendar'   && <CalendarTab />}
        {view === 'timeblocks' && <TimeBlocksTab />}
      </div>
    </div>
  )
}
