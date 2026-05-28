import { useMemo } from 'react'
import { subDays, format, eachDayOfInterval } from 'date-fns'
import { useTransactionsRange, useDailyRecordsRange } from '../../hooks/useRangeQueries'
import { useUserSettings } from '../../hooks/useUserSettings'
import { useAppStore } from '../../store/useAppStore'
import { getUserLocalDate } from '../../lib/dateUtils'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useQuery } from '@tanstack/react-query'
import { db } from '../../db'

const MOOD_EMOJI = ['', '😶', '😕', '😐', '🙂', '😊']

function useWeeklyTasks(from: string, to: string) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['weekly_tasks', from, to, user?.id],
    enabled: !!user,
    staleTime: 0,
    queryFn: async () => {
      if (navigator.onLine) {
        const { data, error } = await supabase
          .from('tasks').select('*')
          .eq('user_id', user!.id)
          .gte('date', from).lte('date', to)
        if (error) throw error
        if (data) await db.tasks.bulkPut(data as Parameters<typeof db.tasks.bulkPut>[0])
        return data ?? []
      }
      return db.tasks.where('date').between(from, to, true, true).toArray()
    }
  })
}

export function WeeklyReviewPage() {
  const { timezone } = useAppStore()
  const { data: settings } = useUserSettings()
  const currency = settings?.currency ?? 'USD'
  const budget = (settings?.daily_budget ?? 100) * 7

  const today = getUserLocalDate(timezone)
  const from  = getUserLocalDate(timezone, subDays(new Date(today + 'T12:00:00'), 6))

  const { data: tasks   = [] } = useWeeklyTasks(from, today)
  const { data: txns    = [] } = useTransactionsRange(from, today)
  const { data: records = [] } = useDailyRecordsRange(from, today)

  const days = eachDayOfInterval({
    start: new Date(from + 'T12:00:00'),
    end:   new Date(today + 'T12:00:00'),
  })

  const totalTasks     = tasks.length
  const completedTasks = tasks.filter(t => t.completed).length
  const taskRate       = totalTasks ? Math.round((completedTasks / totalTasks) * 100) : 0

  const totalExpenses = txns.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
  const totalIncome   = txns.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)

  const moodValues = records.map(r => r.mood).filter((m): m is number => m !== null && m !== undefined)
  const avgMood    = moodValues.length ? (moodValues.reduce((s, m) => s + m, 0) / moodValues.length) : null

  const dayStats = useMemo(() => days.map(d => {
    const date = format(d, 'yyyy-MM-dd')
    const dayTasks = tasks.filter(t => t.date === date)
    const dayTxns  = txns.filter(t => t.date === date)
    const rec      = records.find(r => r.date === date)
    return {
      date,
      label: format(d, 'EEE'),
      tasks: { total: dayTasks.length, done: dayTasks.filter(t => t.completed).length },
      spent: dayTxns.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0),
      mood: rec?.mood ?? null,
    }
  }), [tasks, txns, records, days])

  const maxSpent = Math.max(...dayStats.map(d => d.spent), 1)

  return (
    <div className="space-y-6 pb-12">
      <header>
        <h1 className="text-2xl font-display text-text">Weekly Review</h1>
        <p className="text-sm text-text-secondary mt-1">
          {format(new Date(from + 'T12:00:00'), 'MMM d')} – {format(new Date(today + 'T12:00:00'), 'MMM d, yyyy')}
        </p>
      </header>

      {/* Top stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-surface border border-border rounded-2xl p-4 text-center">
          <p className="text-2xl font-display font-medium text-text">{taskRate}%</p>
          <p className="text-xs text-text-muted mt-1">Tasks done</p>
          <p className="text-[10px] text-text-muted">{completedTasks}/{totalTasks}</p>
        </div>
        <div className="bg-surface border border-border rounded-2xl p-4 text-center">
          <p className="text-2xl font-display font-medium text-text">{totalExpenses.toFixed(0)}</p>
          <p className="text-xs text-text-muted mt-1">Spent {currency}</p>
          <p className={`text-[10px] ${totalExpenses > budget ? 'text-warning' : 'text-text-muted'}`}>
            {totalExpenses > budget ? 'Over' : 'Under'} budget
          </p>
        </div>
        <div className="bg-surface border border-border rounded-2xl p-4 text-center">
          <p className="text-2xl font-display">
            {avgMood ? MOOD_EMOJI[Math.round(avgMood)] : '—'}
          </p>
          <p className="text-xs text-text-muted mt-1">Avg mood</p>
          <p className="text-[10px] text-text-muted">{avgMood ? avgMood.toFixed(1) + '/5' : 'No data'}</p>
        </div>
      </div>

      {/* Day-by-day breakdown */}
      <div className="bg-surface border border-border rounded-2xl p-4 space-y-3">
        <h2 className="text-sm font-medium text-text">Day by day</h2>
        {dayStats.map(d => (
          <div key={d.date} className="flex items-center gap-3">
            <span className="text-xs text-text-muted w-8 flex-shrink-0">{d.label}</span>

            {/* Task mini bar */}
            <div className="flex-1">
              <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
                <div className="h-full bg-accent/60 rounded-full"
                  style={{ width: d.tasks.total ? `${(d.tasks.done / d.tasks.total) * 100}%` : '0%' }} />
              </div>
            </div>

            {/* Spend bar */}
            <div className="flex-1">
              <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
                <div className="h-full bg-info/50 rounded-full"
                  style={{ width: `${(d.spent / maxSpent) * 100}%` }} />
              </div>
            </div>

            {/* Mood */}
            <span className="text-sm w-6 text-center flex-shrink-0">
              {d.mood ? MOOD_EMOJI[d.mood] : <span className="text-text-muted text-xs">·</span>}
            </span>

            {/* Values */}
            <span className="text-[10px] text-text-muted w-20 text-right flex-shrink-0">
              {d.tasks.done}/{d.tasks.total} · {d.spent > 0 ? d.spent.toFixed(0) : '—'}
            </span>
          </div>
        ))}

        <div className="flex items-center gap-3 pt-2 border-t border-border text-[10px] text-text-muted">
          <span className="w-8" />
          <span className="flex-1 flex items-center gap-1"><span className="w-2 h-1.5 bg-accent/60 rounded-full inline-block" /> Tasks</span>
          <span className="flex-1 flex items-center gap-1"><span className="w-2 h-1.5 bg-info/50 rounded-full inline-block" /> Spend</span>
          <span className="w-6" />
          <span className="w-20 text-right">Done · {currency}</span>
        </div>
      </div>

      {/* Finance summary */}
      <div className="bg-surface border border-border rounded-2xl p-4 space-y-3">
        <h2 className="text-sm font-medium text-text">Finance</h2>
        <div className="flex gap-4">
          <div className="flex-1 text-center p-3 bg-surface-2 rounded-xl">
            <p className="text-lg font-display text-success">+{totalIncome.toFixed(2)}</p>
            <p className="text-xs text-text-muted mt-0.5">Income</p>
          </div>
          <div className="flex-1 text-center p-3 bg-surface-2 rounded-xl">
            <p className="text-lg font-display text-text">{totalExpenses.toFixed(2)}</p>
            <p className="text-xs text-text-muted mt-0.5">Expenses</p>
          </div>
          <div className="flex-1 text-center p-3 bg-surface-2 rounded-xl">
            <p className={`text-lg font-display ${totalIncome - totalExpenses >= 0 ? 'text-success' : 'text-danger'}`}>
              {(totalIncome - totalExpenses >= 0 ? '+' : '')}{(totalIncome - totalExpenses).toFixed(2)}
            </p>
            <p className="text-xs text-text-muted mt-0.5">Net</p>
          </div>
        </div>
      </div>
    </div>
  )
}
