import { useNavigate } from 'react-router-dom'
import { Target } from 'lucide-react'
import { useGoalsQuery, useMilestonesQuery } from '../../../hooks/useGoalsQuery'
import { useGoalEventsQuery } from '../../../hooks/useGoalEventsQuery'
import { RadialGauge } from '../../ui/RadialGauge'

export function GoalProgressWidget() {
  const navigate = useNavigate()

  const { data: goals = [], isLoading: loadingGoals } = useGoalsQuery('active')

  const topGoals   = goals.slice(0, 3)
  const topGoalIds = topGoals.map(g => g.id)

  const { data: events     = [], isLoading: loadingEvents     } = useGoalEventsQuery(topGoalIds)
  const { data: milestones = [], isLoading: loadingMilestones } = useMilestonesQuery()

  const isLoading = loadingGoals || loadingEvents || loadingMilestones

  return (
    <div
      onClick={() => navigate('/goals')}
      className="bg-surface border border-border rounded-2xl p-4.5 flex flex-col h-full cursor-pointer hover:border-accent/40 hover:shadow-sm transition-all group"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Target size={15} className="text-accent group-hover:scale-110 transition-transform" />
          <span className="font-semibold text-text uppercase tracking-wider text-[11px]">Goal Progress</span>
        </div>
        <span className="text-[10px] text-text-muted">{goals.length} active</span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center h-full py-4">
            <div className="w-5 h-5 border-2 border-accent/20 border-t-accent rounded-full animate-spin" />
          </div>
        ) : topGoals.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-4 text-center text-text-muted">
            <Target size={24} className="text-text-muted/50 mb-2" />
            <p className="text-xs italic">No active goals yet</p>
            <p className="text-[10px] opacity-75 mt-0.5">Tap to set your first goal</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {topGoals.map(g => {
              const targetVal = g.target || 1
              let progressPct  = 0
              let progressText = ''

              if (g.tracker_type === 'target') {
                const targetProgress = events
                  .filter(e => e.goal_id === g.id)
                  .reduce((sum, e) => {
                    if (e.event_type === 'add')      return sum + (e.value || 0)
                    if (e.event_type === 'subtract') return sum - (e.value || 0)
                    return sum
                  }, 0)
                progressPct  = Math.min(Math.round((targetProgress / targetVal) * 100), 100)
                progressText = `${targetProgress.toLocaleString()} / ${targetVal.toLocaleString()}`
              } else if (g.tracker_type === 'average') {
                const avgLogs = events.filter(e => e.goal_id === g.id)
                const avg     = avgLogs.length
                  ? Math.round((avgLogs.reduce((s, e) => s + e.value, 0) / avgLogs.length) * 10) / 10
                  : 0
                progressPct  = Math.min(Math.round((avg / targetVal) * 100), 100)
                progressText = `Avg: ${avg} / ${targetVal}`
              } else if (g.tracker_type === 'project') {
                const ms          = milestones.filter(m => m.goal_id === g.id)
                const completedMs = ms.filter(m => m.completed).length
                progressPct  = ms.length > 0 ? Math.round((completedMs / ms.length) * 100) : 0
                progressText = `${completedMs}/${ms.length} milestones`
              } else if (g.tracker_type === 'habit') {
                progressPct  = Math.min(g.habit_streak * 10, 100)
                progressText = `${g.habit_streak}d streak 🔥`
              }

              const variant = g.tracker_type === 'habit'
                ? 'warning'
                : progressPct >= 100
                ? 'success'
                : 'accent'

              return (
                <div
                  key={g.id}
                  className="flex items-center justify-between gap-3 p-2 rounded-xl bg-surface-2/40 hover:bg-surface-2/70 transition-colors border border-border/30"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-text truncate group-hover:text-accent transition-colors">
                      {g.name}
                    </p>
                    <p className="text-[10px] text-text-muted truncate mt-0.5">
                      {progressText}
                    </p>
                  </div>
                  <RadialGauge
                    pct={progressPct}
                    size={38}
                    strokeWidth={3.5}
                    variant={variant}
                    label={`${progressPct}%`}
                  />
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
