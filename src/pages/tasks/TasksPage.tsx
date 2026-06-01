import { useState } from 'react'
import { List, LayoutGrid, Calendar, Clock } from 'lucide-react'
import { ListTab } from './components/ListTab'
import { KanbanTab } from './components/KanbanTab'
import { CalendarTab } from './components/CalendarTab'
import { TimeBlocksTab } from './components/TimeBlocksTab'
import clsx from 'clsx'

type View = 'list' | 'kanban' | 'calendar' | 'timeblocks'

const VIEWS = [
  { id: 'list'       as View, label: 'List',        icon: List       },
  { id: 'kanban'     as View, label: 'Kanban',      icon: LayoutGrid },
  { id: 'calendar'   as View, label: 'Calendar',    icon: Calendar   },
  { id: 'timeblocks' as View, label: 'Time Blocks', icon: Clock      },
]

export function TasksPage() {
  const [view, setView] = useState<View>('list')

  return (
    <div className="space-y-4 lg:max-w-5xl">
      <header>
        <h1 className="text-2xl font-display text-text">Tasks</h1>
      </header>

      {/* View switcher */}
      <div className="flex p-1 bg-surface-2 border border-border rounded-xl overflow-x-auto gap-0.5">
        {VIEWS.map(v => {
          const Icon = v.icon
          return (
            <button
              key={v.id}
              onClick={() => setView(v.id)}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-all flex-shrink-0',
                view === v.id
                  ? 'bg-surface text-text shadow-sm'
                  : 'text-text-muted hover:text-text-secondary'
              )}
            >
              <Icon size={15} />
              <span className="hidden sm:inline">{v.label}</span>
            </button>
          )
        })}
      </div>

      {/* Active view */}
      <div className="min-h-[50vh]">
        {view === 'list'       && <ListTab />}
        {view === 'kanban'     && <KanbanTab />}
        {view === 'calendar'   && <CalendarTab />}
        {view === 'timeblocks' && <TimeBlocksTab />}
      </div>
    </div>
  )
}
