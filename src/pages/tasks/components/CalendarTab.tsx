import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, startOfWeek, endOfWeek, isSameDay } from 'date-fns'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../../../hooks/useAuth'
import { useAppStore } from '../../../store/useAppStore'
import { useTaskMutations } from '../../../hooks/useTaskMutations'
import { AddTaskModal } from '../../../components/tasks/AddTaskModal'
import { supabase } from '../../../lib/supabase'
import { db } from '../../../db'
import { getUserLocalDate } from '../../../lib/dateUtils'
import { ChevronLeft, ChevronRight, Check, X, Trash2 } from 'lucide-react'
import type { Task } from '../../../db/schema'
import clsx from 'clsx'

const PRIORITY_COLOR: Record<number, string> = {
  1: 'bg-danger', 2: 'bg-warning', 3: 'bg-info', 4: 'bg-border',
}
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function useMonthTasks(year: number, month: number) {
  const { user } = useAuth()
  const from = format(new Date(year, month, 1), 'yyyy-MM-dd')
  const to   = format(new Date(year, month + 1, 0), 'yyyy-MM-dd')

  return useQuery({
    queryKey: ['tasks', 'calendar', year, month, user?.id],
    enabled: !!user,
    staleTime: 30_000,
    queryFn: async () => {
      if (navigator.onLine) {
        const { data, error } = await supabase
          .from('tasks').select('*')
          .eq('user_id', user!.id)
          .or(`date.gte.${from},due_date.gte.${from}`)
          .or(`date.lte.${to},due_date.lte.${to}`)
          .order('created_at')
        if (error) throw error
        return (data ?? []) as Task[]
      }
      return db.tasks.where('date').between(from, to).toArray() as unknown as Task[]
    },
  })
}

export function CalendarTab() {
  const { timezone } = useAppStore()
  const todayStr  = getUserLocalDate(timezone)
  const todayDate = new Date(todayStr + 'T12:00:00')

  const [cursor, setCursor]     = useState(new Date(todayDate.getFullYear(), todayDate.getMonth(), 1))
  const [selected, setSelected] = useState<Date>(todayDate)

  const { data: tasks = [] } = useMonthTasks(cursor.getFullYear(), cursor.getMonth())
  const selectedDateStr = format(selected, 'yyyy-MM-dd')
  const { updateTask, deleteTask } = useTaskMutations(selectedDateStr)

  const monthStart = startOfMonth(cursor)
  const monthEnd   = endOfMonth(cursor)
  const days       = eachDayOfInterval({ start: startOfWeek(monthStart), end: endOfWeek(monthEnd) })

  const tasksForDay = (day: Date) => {
    const ds = format(day, 'yyyy-MM-dd')
    return tasks.filter(t => t.date === ds || t.due_date === ds)
  }

  const selectedTasks = tasksForDay(selected)

  return (
    <div className="animate-in fade-in duration-200 lg:grid lg:grid-cols-[1fr_320px] lg:gap-6 lg:items-start">

      {/* Calendar grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-text">{format(cursor, 'MMMM yyyy')}</h2>
          <div className="flex gap-1">
            <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
              className="p-1.5 text-text-muted hover:text-text hover:bg-surface-2 rounded-lg transition-colors">
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={() => { setCursor(new Date(todayDate.getFullYear(), todayDate.getMonth(), 1)); setSelected(todayDate) }}
              className="px-3 py-1 text-xs text-text-muted hover:text-text bg-surface-2 rounded-lg border border-border transition-colors">
              Today
            </button>
            <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
              className="p-1.5 text-text-muted hover:text-text hover:bg-surface-2 rounded-lg transition-colors">
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        {/* Day labels */}
        <div className="grid grid-cols-7 gap-1">
          {DAY_LABELS.map(d => (
            <div key={d} className="text-center text-[11px] text-text-muted font-medium py-1 uppercase tracking-wider">{d}</div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7 gap-1">
          {days.map(day => {
            const ds         = format(day, 'yyyy-MM-dd')
            const dayTasks   = tasksForDay(day)
            const isCurrent  = isSameMonth(day, cursor)
            const isSelected = isSameDay(day, selected)
            const isTodayDay = ds === todayStr

            return (
              <button key={ds} onClick={() => setSelected(day)}
                className={clsx(
                  'relative flex flex-col items-center py-1.5 rounded-xl transition-all min-h-[52px]',
                  isSelected ? 'bg-accent text-bg' : isTodayDay ? 'bg-accent/15 text-accent' : 'hover:bg-surface-2',
                  !isCurrent && 'opacity-30'
                )}>
                <span className={clsx('text-sm font-medium', isSelected ? 'text-bg' : isTodayDay ? 'text-accent' : 'text-text')}>
                  {format(day, 'd')}
                </span>
                {dayTasks.length > 0 && (
                  <div className="flex gap-0.5 mt-1 flex-wrap justify-center max-w-[32px]">
                    {dayTasks.slice(0, 4).map(t => (
                      <div key={t.id}
                        className={clsx('w-1.5 h-1.5 rounded-full',
                          isSelected ? 'bg-bg/60' : (PRIORITY_COLOR[t.priority ?? 4] ?? 'bg-accent/60')
                        )} />
                    ))}
                    {dayTasks.length > 4 && (
                      <span className={clsx('text-[9px]', isSelected ? 'text-bg/70' : 'text-text-muted')}>+{dayTasks.length - 4}</span>
                    )}
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Selected day panel */}
      <div className="mt-6 lg:mt-0 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-text">
            {isSameDay(selected, todayDate) ? 'Today' : format(selected, 'EEEE, MMM d')}
          </h3>
          <span className="text-xs text-text-muted">{selectedTasks.length} task{selectedTasks.length !== 1 ? 's' : ''}</span>
        </div>

        <AddTaskModal date={selectedDateStr} />

        {selectedTasks.length === 0 ? (
          <p className="text-xs text-text-muted text-center py-6">No tasks for this day</p>
        ) : (
          <div className="space-y-2">
            {selectedTasks.map(t => (
              <div key={t.id} className={clsx('flex items-center gap-2 p-3 bg-surface border border-border rounded-xl group', t.completed && 'opacity-60')}>
                <button
                  onClick={() => updateTask.mutate({ id: t.id, updates: { completed: !t.completed, completed_at: !t.completed ? new Date().toISOString() : null } })}
                  className={clsx('w-5 h-5 rounded flex items-center justify-center border flex-shrink-0 transition-all',
                    t.completed ? 'bg-success border-success text-bg' : 'border-border hover:border-text-muted text-transparent hover:text-text-muted')}>
                  <Check size={13} strokeWidth={3} />
                </button>
                <span className={clsx('text-sm flex-1 min-w-0 truncate', t.completed ? 'line-through text-text-muted' : 'text-text')}>
                  {t.title}
                </span>
                {t.priority && <div className={clsx('w-2 h-2 rounded-full flex-shrink-0', PRIORITY_COLOR[t.priority] ?? 'bg-border')} />}
                <button
                  onClick={() => updateTask.mutate({ id: t.id, updates: { skipped: true, skipped_at: new Date().toISOString() } })}
                  className="text-text-muted hover:text-warning p-1 opacity-0 group-hover:opacity-100 transition-all" title="Skip">
                  <X size={14} />
                </button>
                <button
                  onClick={() => deleteTask.mutate(t.id)}
                  className="text-text-muted hover:text-danger p-1 opacity-0 group-hover:opacity-100 transition-all" title="Delete">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
