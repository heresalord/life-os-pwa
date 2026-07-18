import { CheckSquare } from 'lucide-react'
import { useTasksQuery } from '../../hooks/useTasksQuery'
import { useDailyRecord } from '../../hooks/useDailyRecord'
import { useAppStore } from '../../store/useAppStore'
import { EmptyState } from '../EmptyState'

export function FocusTasksPanel() {
  const { selectedDate } = useAppStore()
  const { data: tasks = [] } = useTasksQuery(selectedDate)
  const { data: record } = useDailyRecord(selectedDate)

  const pending = tasks.filter(t => !t.completed && !t.skipped)
  const completed = tasks.filter(t => t.completed)
  const pct = tasks.length ? Math.round((completed.length / tasks.length) * 100) : 0

  return (
    <div className="bg-surface border border-border rounded-2xl p-4 space-y-3">
      {record?.intent ? (
        <p className="text-sm text-accent italic">"{record.intent}"</p>
      ) : (
        <p className="text-xs text-text-muted">No intent set for today</p>
      )}

      {tasks.length > 0 && (
        <div>
          <div className="flex justify-between text-xs text-text-muted mb-1">
            <span>{completed.length}/{tasks.length} tasks</span>
            <span>{pct}%</span>
          </div>
          <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
            <div className="h-full bg-success/70 rounded-full transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      {pending.length === 0 ? (
        <EmptyState icon={<CheckSquare size={28} />} title="All clear!" message="No pending tasks for today." />
      ) : (
        <ul className="space-y-2 mt-1">
          {pending.slice(0, 5).map(t => (
            <li key={t.id} className="flex items-start gap-3">
              <div className="mt-0.5 w-4 h-4 rounded border border-border flex-shrink-0" />
              <span className="text-sm text-text leading-snug">{t.title}</span>
              {t.carried_from && <span className="text-xs text-text-muted ml-auto flex-shrink-0">⟳</span>}
            </li>
          ))}
          {pending.length > 5 && (
            <li className="text-xs text-text-muted">+{pending.length - 5} more</li>
          )}
        </ul>
      )}
    </div>
  )
}
