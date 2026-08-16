import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { List, Calendar, Clock } from 'lucide-react'
import { ListTab } from './components/ListTab'
import { CalendarTab } from './components/CalendarTab'
import { TimeBlocksTab } from './components/TimeBlocksTab'
import { AddTaskModal } from '../../components/tasks/AddTaskModal'
import { useTasksQuery } from '../../hooks/useTasksQuery'
import { useAppStore } from '../../store/useAppStore'
import { useTranslation } from '../../i18n'
import { useCollapsibleHeader } from '../../hooks/useCollapsibleHeader'
import clsx from 'clsx'

type View = 'list' | 'calendar' | 'timeblocks'

const VIEWS = [
  { id: 'list'       as View, labelKey: 'tasks.list',       defaultLabel: 'List',        icon: List       },
  { id: 'calendar'   as View, labelKey: 'tasks.calendar',   defaultLabel: 'Calendar',    icon: Calendar   },
  { id: 'timeblocks' as View, labelKey: 'tasks.timeblocks', defaultLabel: 'Time Blocks', icon: Clock      },
] as const

export function TasksPage() {
  const { sentinelRef, isCollapsed } = useCollapsibleHeader()
  const { t } = useTranslation()
  const [view, setView] = useState<View>('list')
  const [searchParams, setSearchParams] = useSearchParams()
  const { setSelectedDate, selectedDate, headerAddTrigger } = useAppStore()
  const [addOpen, setAddOpen] = useState(false)
  const highlight = searchParams.get('highlight')

  // Opens whenever the header's contextual "+" is tapped while on the list view
  useEffect(() => {
    if (headerAddTrigger > 0 && view === 'list') setAddOpen(true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [headerAddTrigger])

  // Completion ratio
  const { data: tasks = [] } = useTasksQuery(selectedDate)
  const completedCount = tasks.filter(t => t.completed).length
  const totalCount = tasks.length

  // Deep link from search: jump to the task's date and switch to list view
  useEffect(() => {
    const date = searchParams.get('date')
    if (date) {
      setSelectedDate(date)
      setView('list')
      const next = new URLSearchParams(searchParams)
      next.delete('date')
      setSearchParams(next, { replace: true })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="space-y-4 lg:max-w-5xl">
      <header className={clsx(
        "flex flex-col justify-start pb-4 collapsible-header-container px-4 -mx-4 md:px-0 md:mx-0",
        isCollapsed && "collapsed"
      )}>
        <h1 className={clsx(
          "font-display text-text transition-all duration-200 ml-4 md:ml-0",
          isCollapsed ? "text-lg font-semibold" : "text-2xl font-bold"
        )}>
          {t('tasks.title', 'Tasks')}
        </h1>
        {totalCount > 0 && (
          <div className={clsx(
            "mt-2 w-full max-w-xs space-y-1 transition-all duration-200 origin-left ml-4 md:ml-0",
            isCollapsed ? "opacity-0 scale-90 h-0 overflow-hidden mt-0" : "opacity-100 scale-100 h-auto"
          )}>
            <p className="text-xs text-text-muted">{completedCount} of {totalCount} done today</p>
            <div className="h-1 bg-border rounded-full overflow-hidden">
              <div
                className="h-full bg-accent rounded-full transition-all duration-500"
                style={{ width: `${(completedCount / totalCount) * 100}%` }}
              />
            </div>
          </div>
        )}
      </header>
      <div ref={sentinelRef} className="h-0 w-full" />

      {/* View switcher */}
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
              <span className={clsx(
                'text-xs sm:text-sm',
                isActive ? 'inline' : 'hidden sm:inline'
              )}>
                {t(v.labelKey, v.defaultLabel)}
              </span>
            </button>
          )
        })}
      </div>

      {/* Active view */}
      <div className="min-h-[50vh] animate-in fade-in duration-200">
        {view === 'list'       && <ListTab highlightId={highlight} />}
        {view === 'calendar'   && <CalendarTab />}
        {view === 'timeblocks' && <TimeBlocksTab />}
      </div>

      {/* Add Task modal — opened via the header's contextual "+" action */}
      <AddTaskModal date={selectedDate} open={addOpen} onOpenChange={setAddOpen} />
    </div>
  )
}
