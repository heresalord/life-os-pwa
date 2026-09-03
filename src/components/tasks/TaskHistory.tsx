import { useState, useEffect } from 'react'
import { subDays, format } from 'date-fns'
import { useAuth } from '../../hooks/useAuth'
import { useAppStore } from '../../store/useAppStore'
import { getUserLocalDate } from '../../lib/dateUtils'
import { supabase } from '../../lib/supabase'
import { CheckSquare, Square, Minus, ChevronLeft, ChevronRight, Calendar } from 'lucide-react'

interface HistoricalTask {
  id: string; title: string; completed: boolean
  skipped: boolean; priority: number | null; carried_from: string | null
}

const QUICK_JUMPS = [
  { label: 'Yest.', days: 1 },
  { label: '2d', days: 2 },
  { label: '3d', days: 3 },
  { label: '1w', days: 7 },
  { label: '2w', days: 14 },
  { label: '1m', days: 30 },
]

export function TaskHistory() {
  const { user } = useAuth()
  const { timezone } = useAppStore()
  const today = getUserLocalDate(timezone)

  const [offset, setOffset] = useState(1)
  const [cache, setCache] = useState<Record<string, HistoricalTask[]>>({})
  const [loading, setLoading] = useState(false)

  const date = getUserLocalDate(timezone, subDays(new Date(today + 'T12:00:00'), offset))
  const tasks = cache[date] ?? null

  useEffect(() => {
    if (!user || cache[date] !== undefined) return
    setLoading(true)
    supabase.from('tasks').select('*').eq('user_id', user.id).eq('date', date).order('created_at')
      .then(({ data }) => {
        setCache(prev => ({ ...prev, [date]: (data ?? []) as HistoricalTask[] }))
        setLoading(false)
      })
  }, [date, user]) // eslint-disable-line react-hooks/exhaustive-deps

  const displayLabel = offset === 1 ? 'Yesterday' : offset === 7 ? 'One week ago' : `${offset} days ago`
  const displayDay = format(new Date(date + 'T12:00:00'), 'EEEE, MMM d')

  const completed = tasks?.filter(t => t.completed) ?? []
  const pending   = tasks?.filter(t => !t.completed && !t.skipped) ?? []
  const skipped   = tasks?.filter(t => t.skipped) ?? []

  return (
    <div className="space-y-4">
      {/* Date navigator */}
      <div className="flex items-center gap-3">
        <button onClick={() => setOffset(o => o + 1)}
          className="w-9 h-9 rounded-xl bg-surface-2 border border-border flex items-center justify-center text-text-muted hover:text-text transition-colors">
          <ChevronLeft size={18} />
        </button>
        <div className="flex-1 text-center">
          <p className="text-sm font-medium text-text">{displayDay}</p>
          <p className="text-xs text-text-muted">{displayLabel}</p>
        </div>
        <button onClick={() => setOffset(o => Math.max(1, o - 1))} disabled={offset <= 1}
          className="w-9 h-9 rounded-xl bg-surface-2 border border-border flex items-center justify-center text-text-muted hover:text-text transition-colors disabled:opacity-30">
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Quick jumps */}
      <div className="flex gap-2">
        {QUICK_JUMPS.map(({ label, days }) => (
          <button key={days} onClick={() => setOffset(days)}
            className={`flex-1 py-2 text-xs font-medium rounded-lg border transition-colors ${
              offset === days
                ? 'bg-accent/15 border-accent/40 text-accent'
                : 'bg-surface-2 border-border text-text-muted hover:text-text'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-10">
          <div className="w-5 h-5 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
        </div>
      ) : tasks === null ? (
        <div className="py-10 text-center">
          <Calendar size={28} className="text-text-muted mx-auto mb-2" />
          <p className="text-sm text-text-muted">Select a day above</p>
        </div>
      ) : tasks.length === 0 ? (
        <div className="py-10 text-center bg-surface-2 rounded-2xl border border-dashed border-border">
          <p className="text-sm text-text-muted">No tasks recorded for this day.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Summary stats */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Done', count: completed.length, color: 'text-success', bg: 'bg-success/10 border-success/20' },
              { label: 'Missed', count: pending.length, color: 'text-text-muted', bg: 'bg-surface-2 border-border' },
              { label: 'Skipped', count: skipped.length, color: 'text-warning', bg: 'bg-warning/10 border-warning/20' },
            ].map(s => (
              <div key={s.label} className={`${s.bg} rounded-xl p-3 text-center border`}>
                <p className={`text-2xl font-display font-medium ${s.color}`}>{s.count}</p>
                <p className="text-xs text-text-muted mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Read-only task list */}
          <div className="space-y-2">
            {tasks.map(t => (
              <div key={t.id}
                className={`flex items-center gap-3 px-3 py-2 rounded-xl border ${
                  t.completed ? 'bg-surface border-border/50 opacity-60'
                  : t.skipped  ? 'bg-surface border-border/40 opacity-40'
                  : 'bg-surface-2/50 border-border'
                }`}>
                {t.completed
                  ? <CheckSquare size={15} className="text-success flex-shrink-0" />
                  : t.skipped
                  ? <Minus size={15} className="text-warning flex-shrink-0" />
                  : <Square size={15} className="text-text-muted flex-shrink-0" />}
                <span className={`text-sm flex-1 min-w-0 truncate ${t.completed ? 'line-through text-text-muted' : 'text-text'}`}>
                  {t.title}
                </span>
                {t.carried_from && <span className="text-[10px] text-text-muted flex-shrink-0">⟳</span>}
                {t.priority && <span className="text-[10px] text-accent flex-shrink-0 font-medium">P{t.priority}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
