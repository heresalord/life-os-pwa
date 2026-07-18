import { useNavigate } from 'react-router-dom'
import { Flame } from 'lucide-react'
import { useGoalsQuery, useHabitLogsQuery } from '../../../hooks/useGoalsQuery'
import { useGoalMutations } from '../../../hooks/useGoalMutations'
import { startOfWeek, endOfWeek, eachDayOfInterval, format, isSameDay } from 'date-fns'
import { haptic } from '../../../lib/haptic'
import clsx from 'clsx'

export function HabitStreakWidget() {
  const navigate = useNavigate()
  const { data: goals = [], isLoading: loadingGoals } = useGoalsQuery('active')
  const { data: habitLogs = [], isLoading: loadingLogs } = useHabitLogsQuery()
  const { addHabitLog, deleteHabitLog } = useGoalMutations()

  const habits   = goals.filter(g => g.tracker_type === 'habit').slice(0, 3)
  const isLoading = loadingGoals || loadingLogs

  const start    = startOfWeek(new Date(), { weekStartsOn: 1 })
  const end      = endOfWeek(new Date(), { weekStartsOn: 1 })
  const weekDays = eachDayOfInterval({ start, end })

  const handleHabitToggle = async (e: React.MouseEvent, goalId: string, dateStr: string, currentStatus: 'check' | 'fail' | 'none') => {
    e.stopPropagation()
    haptic('light')
    try {
      if (currentStatus === 'none') {
        await addHabitLog.mutateAsync({ goal_id: goalId, date: dateStr, value: 1 })
      } else if (currentStatus === 'check') {
        await addHabitLog.mutateAsync({ goal_id: goalId, date: dateStr, value: 0 })
      } else {
        await deleteHabitLog.mutateAsync({ goal_id: goalId, date: dateStr })
      }
    } catch (err) {
      console.error('Failed to toggle habit log:', err)
    }
  }

  return (
    <div
      onClick={() => navigate('/goals')}
      className="bg-surface border border-border rounded-2xl p-4.5 flex flex-col h-full cursor-pointer hover:border-accent/40 hover:shadow-sm transition-all group"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Flame size={15} className="text-accent group-hover:scale-110 transition-transform" />
          <span className="font-semibold text-text uppercase tracking-wider text-[11px]">Habit Streak Grid</span>
        </div>
        <span className="text-[10px] text-text-muted">Week View</span>
      </div>

      {/* Habits */}
      <div className="flex-1 overflow-y-auto space-y-3.5">
        {isLoading ? (
          <div className="flex items-center justify-center h-full py-4">
            <div className="w-5 h-5 border-2 border-accent/20 border-t-accent rounded-full animate-spin" />
          </div>
        ) : habits.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-4 text-center text-text-muted">
            <p className="text-xs italic">No active habits yet 🔥</p>
            <p className="text-[10px] opacity-75 mt-0.5">Tap to set up a habit goal</p>
          </div>
        ) : (
          <div className="space-y-3">
            {habits.map(h => (
              <div key={h.id} className="space-y-1.5 border-b border-border/20 last:border-0 pb-2 last:pb-0">
                <div className="flex items-baseline justify-between text-xs">
                  <span className="text-text-secondary font-medium truncate max-w-[70%]">{h.name}</span>
                  <span className="text-[10px] text-warning font-semibold flex items-center gap-1 flex-shrink-0">
                    <Flame size={10} className="fill-warning" />{h.habit_streak}d
                  </span>
                </div>

                <div className="grid grid-cols-7 gap-1">
                  {weekDays.map(d => {
                    const dateStr     = format(d, 'yyyy-MM-dd')
                    const log         = habitLogs.find(l => l.goal_id === h.id && l.date === dateStr)
                    const status      = log === undefined ? 'none' : log.value === 1 ? 'check' : 'fail'
                    const isTodayDate = isSameDay(d, new Date())
                    const label       = format(d, 'eeeeee')[0]

                    return (
                      <button
                        key={dateStr}
                        type="button"
                        onClick={(e) => handleHabitToggle(e, h.id, dateStr, status)}
                        className={clsx(
                          "flex flex-col items-center justify-center py-2 rounded-lg border text-[9px] font-bold transition-all aspect-square relative",
                          status === 'check' && "bg-success/15 border-success/35 text-success",
                          status === 'fail'  && "bg-danger/15 border-danger/35 text-danger",
                          status === 'none'  && "bg-surface-2 border-border/80 text-text-muted hover:border-text-secondary hover:text-text",
                          isTodayDate && "ring-1.5 ring-accent ring-offset-1 ring-offset-bg"
                        )}
                        title={`${format(d, 'do MMM')}: ${status === 'check' ? 'Checked' : status === 'fail' ? 'Failed' : 'None'}`}
                      >
                        <span className="uppercase text-[8px] opacity-50 mb-0.5">{label}</span>
                        <span className="text-[10px] leading-none">
                          {status === 'check' ? '✓' : status === 'fail' ? '✗' : '·'}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
