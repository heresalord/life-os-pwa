import { useNavigate } from 'react-router-dom'
import { Flame } from 'lucide-react'
import { useGoalsQuery, useHabitLogsQuery } from '../../../hooks/useGoalsQuery'
import { useGoalMutations } from '../../../hooks/useGoalMutations'
import { startOfWeek, endOfWeek, eachDayOfInterval, format } from 'date-fns'
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

  const handleHabitToggle = async (e: React.MouseEvent, goalId: string, dateStr: string, _hasLog: boolean, currentValue: number | undefined, _isPast: boolean) => {
    e.stopPropagation()
    haptic('light')
    try {
      if (currentValue === 1) {
        // Checked -> Explicit Fail
        await addHabitLog.mutateAsync({ goal_id: goalId, date: dateStr, value: 0 })
      } else if (currentValue === 0) {
        // Explicit Fail -> Reset
        await deleteHabitLog.mutateAsync({ goal_id: goalId, date: dateStr })
      } else {
        // Missed (past) or Pending (today) -> Complete
        await addHabitLog.mutateAsync({ goal_id: goalId, date: dateStr, value: 1 })
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
      <div className="flex-1 overflow-y-auto space-y-4">
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
              <div key={h.id} className="space-y-2 border-b border-border/20 last:border-0 pb-2 last:pb-0">
                <div className="flex items-baseline justify-between text-xs">
                  <span className="text-text-secondary font-medium truncate max-w-[70%]">{h.name}</span>
                  <span className="text-[10px] text-warning font-semibold flex items-center gap-1 flex-shrink-0">
                    <Flame size={10} className="fill-warning" />{h.habit_streak}d
                  </span>
                </div>

                <div className="grid grid-cols-7 gap-1">
                  {weekDays.map(d => {
                    const dateStr     = format(d, 'yyyy-MM-dd')
                    const todayStr    = format(new Date(), 'yyyy-MM-dd')
                    const log         = habitLogs.find(l => l.goal_id === h.id && l.date === dateStr)
                    const isPast      = dateStr < todayStr
                    const isTodayDate = dateStr === todayStr
                    const isFuture    = dateStr > todayStr
                    
                    const isComplete     = log?.value === 1
                    const isExplicitFail = log?.value === 0
                    const isMissed       = isPast && log === undefined
                    const label          = format(d, 'eeeeee')[0]

                    return (
                      <button
                        key={dateStr}
                        type="button"
                        disabled={isFuture}
                        onClick={(e) => handleHabitToggle(e, h.id, dateStr, !!log, log?.value, isPast)}
                        className={clsx(
                          "flex flex-col items-center justify-center py-2 rounded-lg border text-[9px] font-bold transition-all aspect-square relative select-none",
                          isFuture && "bg-transparent border-transparent cursor-default opacity-40",
                          isComplete && "bg-success/20 border-success/40 text-success shadow-[0_0_4px_rgba(34,197,94,0.2)]",
                          (isExplicitFail || isMissed) && "bg-danger/20 border-danger/40 text-danger",
                          (!log && isTodayDate) && "bg-surface-2 border-accent text-text-muted ring-1.5 ring-accent ring-offset-1 ring-offset-bg",
                          (!log && !isPast && !isTodayDate && !isFuture) && "bg-surface-2 border-border/80 text-text-muted hover:border-text-secondary hover:text-text"
                        )}
                        title={`${format(d, 'do MMM')}: ${
                          isComplete ? 'Checked (Tap to change)' :
                          isExplicitFail ? 'Failed (Tap to reset)' :
                          isMissed ? 'Missed (Tap to check in)' :
                          isTodayDate ? 'Today (Tap to check in)' : 'Scheduled'
                        }`}
                      >
                        <span className="uppercase text-[8px] opacity-60 mb-0.5">{label}</span>
                        <span className="text-[10px] leading-none">
                          {isComplete ? '✓' : (isExplicitFail || isMissed) ? '✗' : '·'}
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
