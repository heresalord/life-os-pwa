import { useNavigate } from 'react-router-dom'
import { Clock } from 'lucide-react'
import { useAgendaQuery } from '../../../hooks/useAgendaQuery'
import { useTasksQuery } from '../../../hooks/useTasksQuery'
import { useAppStore } from '../../../store/useAppStore'

interface CombinedItem {
  id: string
  type: 'block' | 'task'
  title: string
  startTime: string
  endTime: string | null
}

function timeToMinutes(t: string) {
  if (!t) return 0
  const [h, m] = t.split(':').map(Number)
  return h * 60 + (m || 0)
}

export function UpcomingBlocksWidget() {
  const navigate = useNavigate()
  const { selectedDate } = useAppStore()
  const { data: blocks = [], isLoading: loadingBlocks } = useAgendaQuery(selectedDate)
  const { data: tasks  = [], isLoading: loadingTasks  } = useTasksQuery(selectedDate)

  const isLoading = loadingBlocks || loadingTasks

  const scheduledTasks: CombinedItem[] = tasks
    .filter(t => t.time_block_start && !t.completed && !t.skipped)
    .map(t => ({
      id:        t.id,
      type:      'task',
      title:     t.title,
      startTime: t.time_block_start!,
      endTime:   t.time_block_end,
    }))

  const agendaItems: CombinedItem[] = blocks.map(b => ({
    id:        b.id,
    type:      'block',
    title:     b.description,
    startTime: b.start_time,
    endTime:   b.end_time,
  }))

  const combined: CombinedItem[] = [...scheduledTasks, ...agendaItems].sort(
    (a, b) => a.startTime.localeCompare(b.startTime)
  )

  const now            = new Date()
  const currentMinutes = now.getHours() * 60 + now.getMinutes()

  const upcoming = combined
    .filter(item => timeToMinutes(item.endTime ?? item.startTime) >= currentMinutes)
    .slice(0, 3)

  return (
    <div
      onClick={() => navigate('/tasks')}
      className="bg-surface border border-border rounded-2xl p-4.5 flex flex-col h-full cursor-pointer hover:border-accent/40 hover:shadow-sm transition-all group"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Clock size={15} className="text-accent group-hover:scale-110 transition-transform" />
          <span className="font-semibold text-text uppercase tracking-wider text-[11px]">Upcoming Agenda</span>
        </div>
        <span className="text-[10px] text-text-muted">Today</span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto space-y-2">
        {isLoading ? (
          <div className="flex items-center justify-center h-full py-4">
            <div className="w-5 h-5 border-2 border-accent/20 border-t-accent rounded-full animate-spin" />
          </div>
        ) : upcoming.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-4 text-center text-text-muted">
            <p className="text-xs italic">Clear schedule for the rest of today! ☕</p>
            <p className="text-[10px] opacity-75 mt-0.5">Tap to view full day timeline</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {upcoming.map(item => (
              <div
                key={item.id}
                className="flex items-center gap-3 p-2 bg-surface-2/60 border border-border/40 hover:bg-surface-2 rounded-xl transition-colors group/item"
              >
                <div className="text-[10px] font-bold text-accent bg-accent/10 border border-accent/15 px-2 py-1 rounded-lg flex-shrink-0 text-center min-w-[70px]">
                  {item.startTime}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-text-secondary font-medium truncate group-hover/item:text-text transition-colors">
                    {item.title}
                  </p>
                  <p className="text-[9px] text-text-muted">
                    {item.type === 'task' ? '⚡ Scheduled Task' : '📅 Agenda Block'}
                    {item.endTime && ` · ends ${item.endTime}`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
