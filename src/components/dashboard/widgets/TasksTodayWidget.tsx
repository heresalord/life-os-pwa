import { useNavigate } from 'react-router-dom'
import { CheckSquare, Circle } from 'lucide-react'
import { useTasksQuery } from '../../../hooks/useTasksQuery'
import { useTaskMutations } from '../../../hooks/useTaskMutations'
import { useAppStore } from '../../../store/useAppStore'
import { haptic } from '../../../lib/haptic'
import clsx from 'clsx'

export function TasksTodayWidget() {
  const navigate = useNavigate()
  const { selectedDate } = useAppStore()
  const { data: tasks = [], isLoading } = useTasksQuery(selectedDate)
  const { updateTask } = useTaskMutations(selectedDate)

  const pendingTasks = tasks
    .filter(t => !t.completed && !t.skipped)
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
    .slice(0, 5)

  const handleToggleComplete = (e: React.MouseEvent, id: string, completed: boolean) => {
    e.stopPropagation()
    haptic('medium')
    updateTask.mutate({
      id,
      updates: {
        completed: !completed,
        skipped: false,
        completed_at: !completed ? new Date().toISOString() : null,
      },
    })
  }

  const getPriorityColor = (priority: number | null) => {
    if (!priority)    return 'bg-border/60'
    if (priority >= 4) return 'bg-danger'
    if (priority >= 3) return 'bg-warning'
    return 'bg-info'
  }

  return (
    <div
      onClick={() => navigate('/tasks')}
      className="bg-surface border border-border rounded-2xl p-4.5 flex flex-col h-full cursor-pointer hover:border-accent/40 hover:shadow-sm transition-all group"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <CheckSquare size={15} className="text-accent group-hover:scale-110 transition-transform" />
          <span className="font-semibold text-text uppercase tracking-wider text-[11px]">Today's Focus Tasks</span>
        </div>
        <span className="text-[10px] text-text-muted">
          {tasks.filter(t => t.completed).length}/{tasks.length} done
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto space-y-2">
        {isLoading ? (
          <div className="flex items-center justify-center h-full py-4">
            <div className="w-5 h-5 border-2 border-accent/20 border-t-accent rounded-full animate-spin" />
          </div>
        ) : pendingTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-4 text-center text-text-muted">
            <p className="text-xs italic">All caught up! ✨</p>
            <p className="text-[10px] opacity-75 mt-0.5">Tap to view all tasks</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {pendingTasks.map(t => (
              <div
                key={t.id}
                onClick={(e) => handleToggleComplete(e, t.id, t.completed)}
                className="flex items-center gap-3 p-2 bg-surface-2/60 border border-border/40 hover:bg-surface-2 rounded-xl transition-colors group/item"
              >
                <button type="button" className="text-text-secondary hover:text-accent transition-colors flex-shrink-0">
                  <Circle size={14} className="group-hover/item:scale-110 transition-transform" />
                </button>

                <span className="text-xs text-text-secondary truncate flex-1 font-medium group-hover/item:text-text transition-colors">
                  {t.title}
                </span>

                {t.priority && (
                  <span className={clsx('w-1.5 h-1.5 rounded-full flex-shrink-0', getPriorityColor(t.priority))} />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
