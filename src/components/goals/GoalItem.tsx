import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus,
  ChevronDown,
  ChevronUp,
  Check,
  Flame,
  Trash2,
  Calendar,
  Activity,
  Dumbbell,
  DollarSign,
  BookOpen,
  Briefcase,
  Users,
  Compass,
  Palette,
  Map,
  Target as TargetIcon,
  Milestone as MilestoneIcon,
  ChevronRight
} from 'lucide-react'
import { useGoalMutations } from '../../hooks/useGoalMutations'
import { useHabitLogsQuery, useMilestonesQuery } from '../../hooks/useGoalsQuery'
import { useGoalEventsQuery } from '../../hooks/useGoalEventsQuery'
import { useProjectsQuery } from '../../hooks/useProjectsQuery'
import { haptic } from '../../lib/haptic'
import type { Goal } from '../../db/schema'
import clsx from 'clsx'
import { startOfWeek, endOfWeek, eachDayOfInterval, format, isSameDay } from 'date-fns'

const CATEGORY_ICONS: Record<string, any> = {
  Health: Activity,
  Fitness: Dumbbell,
  Finance: DollarSign,
  Learning: BookOpen,
  Career: Briefcase,
  Relationships: Users,
  Mindfulness: Compass,
  Creative: Palette,
  Travel: Map,
  Routine: Calendar,
}

const CATEGORY_COLORS: Record<string, string> = {
  Health: 'text-info bg-info/10 border-info/20',
  Fitness: 'text-danger bg-danger/10 border-danger/20',
  Finance: 'text-success bg-success/10 border-success/20',
  Learning: 'text-accent bg-accent/10 border-accent/20',
  Career: 'text-warning bg-warning/10 border-warning/20',
  Relationships: 'text-info bg-info/10 border-info/20',
  Mindfulness: 'text-accent bg-accent/10 border-accent/20',
  Creative: 'text-warning bg-warning/10 border-warning/20',
  Travel: 'text-success bg-success/10 border-success/20',
  Routine: 'text-accent bg-accent/10 border-accent/20',
}

export function GoalItem({ goal }: { goal: Goal }) {
  const navigate = useNavigate()
  const {
    updateGoal,
    deleteGoal,
    addEvent,
    addHabitLog,
    deleteHabitLog,
    toggleMilestone
  } = useGoalMutations()

  const [expanded, setExpanded] = useState(false)
  const { data: projects } = useProjectsQuery()
  const linkedProject = projects?.find(p => p.id === goal.project_id)
  const [logValue, setLogValue] = useState('1')
  const [showLog, setShowLog] = useState(false)

  // Fetch sub-data based on tracker type
  const { data: milestones = [] } = useMilestonesQuery(goal.tracker_type === 'project' ? goal.id : undefined)
  const { data: habitLogs = [] } = useHabitLogsQuery(goal.tracker_type === 'habit' ? goal.id : undefined)
  const { data: events = [] } = useGoalEventsQuery(
    (goal.tracker_type === 'target' || goal.tracker_type === 'average') ? [goal.id] : []
  )

  // 1. Calculate values based on tracker type
  const targetVal = goal.target || 1

  // Target tracker: sum of events
  const targetProgress = events
    .filter(e => e.goal_id === goal.id)
    .reduce((sum, e) => {
      if (e.event_type === 'add')      return sum + (e.value || 0)
      if (e.event_type === 'subtract') return sum - (e.value || 0)
      return sum
    }, 0)

  // Average tracker: average of events
  const avgLogs = events.filter(e => e.goal_id === goal.id)
  const averageProgress = avgLogs.length
    ? Math.round((avgLogs.reduce((sum, e) => sum + e.value, 0) / avgLogs.length) * 10) / 10
    : 0

  // Project tracker: percentage of completed milestones
  const totalMilestones = milestones.length
  const completedMilestones = milestones.filter(m => m.completed).length
  const projectPct = totalMilestones > 0 ? Math.round((completedMilestones / totalMilestones) * 100) : 0

  // Overall progress percentage for visual progress bars
  const pct =
    goal.tracker_type === 'target' ? Math.min(Math.round((targetProgress / targetVal) * 100), 100)
    : goal.tracker_type === 'average' ? Math.min(Math.round((averageProgress / targetVal) * 100), 100)
    : goal.tracker_type === 'project' ? projectPct
    : 0

  const isComplete =
    goal.tracker_type === 'target' ? targetProgress >= targetVal
    : goal.tracker_type === 'average' ? averageProgress >= targetVal
    : goal.tracker_type === 'project' ? (totalMilestones > 0 && completedMilestones === totalMilestones)
    : goal.tracker_type === 'habit' ? goal.habit_streak > 0 && goal.last_checkin === format(new Date(), 'yyyy-MM-dd')
    : false

  // Format unit label
  const unitLabel =
    goal.measurement_type === 'currency' ? '$'
    : goal.measurement_type === 'time' ? 'hrs'
    : goal.measurement_type === 'percentage' ? '%'
    : 'units'

  // Categories & Icons
  const CatIcon = CATEGORIES_MAP_ICON(goal.category)
  const catColor = CATEGORY_COLORS[goal.category || ''] || 'text-text-secondary bg-surface-2 border-border/40'

  function CATEGORIES_MAP_ICON(catName: string | null) {
    if (!catName) return TargetIcon
    return CATEGORY_ICONS[catName] || TargetIcon
  }

  // Toggle habit check-in for a specific date in the week grid
  const handleHabitToggle = (dateStr: string, currentStatus: 'check' | 'fail' | 'none') => {
    haptic('light')
    if (currentStatus === 'none') {
      // none -> check
      addHabitLog.mutate({ goal_id: goal.id, date: dateStr, value: 1 })
    } else if (currentStatus === 'check') {
      // check -> fail
      addHabitLog.mutate({ goal_id: goal.id, date: dateStr, value: 0 })
    } else {
      // fail -> none (delete)
      deleteHabitLog.mutate({ goal_id: goal.id, date: dateStr })
    }
  }

  // Handle Target/Average value logging
  const handleLog = (direction: 'add' | 'subtract') => {
    const val = parseFloat(logValue) || 1
    if (val <= 0) return
    haptic('medium')
    addEvent.mutate({
      goal_id: goal.id,
      date: format(new Date(), 'yyyy-MM-dd'),
      value: val,
      event_type: direction
    })
    setShowLog(false)
  }

  const handleMarkComplete = () => {
    updateGoal.mutate({ id: goal.id, updates: { is_completed: true, state: 'completed' } })
  }

  const handleArchive = () => {
    updateGoal.mutate({ id: goal.id, updates: { state: 'abandoned' } })
  }

  // Weekdays grid calculator for Habit (Mon -> Sun of current week)
  const renderWeeklyGrid = () => {
    const start = startOfWeek(new Date(), { weekStartsOn: 1 }) // Monday
    const end = endOfWeek(new Date(), { weekStartsOn: 1 }) // Sunday
    const days = eachDayOfInterval({ start, end })

    return (
      <div className="grid grid-cols-7 gap-1 mt-3">
        {days.map(d => {
          const dateStr = format(d, 'yyyy-MM-dd')
          const log = habitLogs.find(l => l.date === dateStr)
          
          const status = log === undefined ? 'none' : log.value === 1 ? 'check' : 'fail'
          const label = format(d, 'eeeeee') // M, T, W...
          const isTodayDate = isSameDay(d, new Date())

          return (
            <button
              key={dateStr}
              type="button"
              onClick={() => handleHabitToggle(dateStr, status)}
              className={clsx(
                'flex flex-col items-center justify-center p-2 rounded-xl border text-[10px] font-bold transition-all duration-200 aspect-square',
                status === 'check' ? 'bg-success/15 border-success/40 text-success'
                : status === 'fail' ? 'bg-danger/15 border-danger/40 text-danger'
                : 'bg-surface-2 border-border/80 text-text-muted hover:border-text-secondary hover:text-text',
                isTodayDate && 'ring-2 ring-accent ring-offset-2 ring-offset-bg'
              )}
            >
              <span className="uppercase text-[9px] opacity-60 tracking-wider mb-1">{label}</span>
              <span className="text-xs">
                {status === 'check' ? '✓' : status === 'fail' ? '✗' : '-'}
              </span>
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <div className={clsx(
      'bg-surface border rounded-2xl p-4 flex flex-col justify-between transition-all duration-300 hover:shadow-md relative overflow-hidden group',
      isComplete ? 'border-success/30 ring-1 ring-success/10' : 'border-border'
    )}>
      {/* Top badges */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className={clsx(
            'flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border flex-shrink-0',
            catColor
          )}>
            <CatIcon size={10} />
            {goal.category || 'General'}
          </span>
          {linkedProject && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-accent/20 bg-accent/5 text-accent truncate max-w-[100px]" title={`Project: ${linkedProject.name}`}>
              {linkedProject.name}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-[9px] font-bold text-text-secondary uppercase bg-surface-2 border border-border px-2 py-0.5 rounded-full tracking-wider">
            {goal.tracker_type}
          </span>
          <button
            onClick={() => navigate(`/goals/${goal.id}`)}
            className="text-text-secondary hover:text-accent p-1 rounded-full hover:bg-surface-2 transition-colors"
            title="View Details"
          >
            <ChevronRight size={15} />
          </button>
        </div>
      </div>

      {/* Goal Title / Link */}
      <div className="flex-1 cursor-pointer" onClick={() => navigate(`/goals/${goal.id}`)}>
        <h3 className="text-sm font-semibold text-text group-hover:text-accent transition-colors leading-snug flex items-center gap-1">
          {goal.name}
          {isComplete && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-success/15 text-success">
              DONE
            </span>
          )}
        </h3>

        {/* Target/Average Stats */}
        {goal.tracker_type === 'target' && (
          <p className="text-xs text-text-muted mt-1">
            <span className="font-semibold text-text-secondary">{targetProgress.toLocaleString()}</span> / {targetVal.toLocaleString()} {unitLabel}
          </p>
        )}

        {goal.tracker_type === 'average' && (
          <p className="text-xs text-text-muted mt-1">
            Current: <span className="font-semibold text-text-secondary">{averageProgress}</span> {unitLabel} (Target: {targetVal} {unitLabel})
          </p>
        )}

        {goal.tracker_type === 'project' && (
          <p className="text-xs text-text-muted mt-1">
            Milestones: <span className="font-semibold text-text-secondary">{completedMilestones}</span> of {totalMilestones} ({projectPct}%)
          </p>
        )}

        {/* Habit Streak Display */}
        {goal.tracker_type === 'habit' && (
          <div className="flex items-center gap-3 mt-1.5">
            <div className="flex items-center gap-1 text-xs text-text font-medium bg-warning/10 border border-warning/20 text-warning px-2.5 py-0.5 rounded-full">
              <Flame size={12} className="fill-warning" />
              <span>{goal.habit_streak} day streak</span>
            </div>
            {goal.last_checkin && (
              <span className="text-[10px] text-text-muted">
                Last checkin: {goal.last_checkin}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Dynamic Visual Tracker */}
      {goal.tracker_type === 'habit' && (
        <div className="mt-2">
          {renderWeeklyGrid()}
        </div>
      )}

      {(goal.tracker_type === 'target' || goal.tracker_type === 'average' || goal.tracker_type === 'project') && (
        <div className="space-y-1.5 mt-4">
          <div className="flex items-center justify-between text-[10px] font-semibold text-text-secondary">
            <span>Progress</span>
            <span>{pct}%</span>
          </div>
          <div className="h-2 bg-surface-2 border border-border/50 rounded-full overflow-hidden">
            <div
              className={clsx(
                'h-full rounded-full transition-all duration-700 ease-out',
                isComplete ? 'bg-success' : 'bg-accent/80'
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {/* Top 3 Milestones check-off for projects */}
      {goal.tracker_type === 'project' && milestones.length > 0 && (
        <div className="mt-3.5 space-y-1 bg-surface-2/40 border border-border/40 p-2.5 rounded-xl">
          <p className="text-[9px] font-bold text-text-secondary uppercase tracking-wider mb-1.5 flex items-center gap-1">
            <MilestoneIcon size={9} /> Milestones Quick Checklist
          </p>
          {milestones.slice(0, 3).map(m => (
            <button
              key={m.id}
              onClick={() => toggleMilestone.mutate({ id: m.id, completed: !m.completed })}
              className="w-full flex items-center gap-2 text-left text-xs text-text hover:bg-surface rounded-lg p-1.5 transition-colors border border-transparent hover:border-border/50"
            >
              <div className={clsx(
                'w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 transition-colors',
                m.completed ? 'bg-success border-success text-bg' : 'border-border bg-surface'
              )}>
                {m.completed && <Check size={10} strokeWidth={3} />}
              </div>
              <span className={clsx(
                'truncate flex-1',
                m.completed && 'line-through text-text-muted'
              )}>
                {m.title}
              </span>
            </button>
          ))}
          {milestones.length > 3 && (
            <button
              onClick={() => navigate(`/goals/${goal.id}`)}
              className="text-[10px] text-accent font-semibold hover:underline mt-1 block pl-1"
            >
              + {milestones.length - 3} more milestones
            </button>
          )}
        </div>
      )}

      {/* SMART Info block ( measurable target + deadline ) */}
      <div className="mt-4 pt-3.5 border-t border-border/50 flex items-center justify-between text-[11px] text-text-muted">
        <span className="flex items-center gap-1.5 truncate max-w-[60%]">
          <TargetIcon size={12} className="text-text-muted flex-shrink-0" /> <span className="truncate">Target: {targetVal} {goal.measurement_type !== 'binary' ? unitLabel : ''}</span>
        </span>
        {goal.end_date ? (
          <span className="flex items-center gap-1.5 flex-shrink-0 text-text-secondary">
            <Calendar size={12} className="text-text-muted flex-shrink-0" /> {goal.end_date}
          </span>
        ) : (
          <span className="text-[10px] opacity-60">No deadline</span>
        )}
      </div>

      {/* Quick Add log panel for Target and Average */}
      {(goal.tracker_type === 'target' || goal.tracker_type === 'average') && !isComplete && (
        <div className="absolute right-3 bottom-[48px]">
          <button
            onClick={() => setShowLog(v => !v)}
            className="w-8 h-8 rounded-full bg-accent/10 border border-accent/20 text-accent flex items-center justify-center hover:bg-accent/20 hover:scale-105 active:scale-95 transition-all shadow-sm"
            title="Log progress"
          >
            <Plus size={15} strokeWidth={2.5} />
          </button>
        </div>
      )}

      {showLog && (
        <div className="mt-3 pt-3 border-t border-border/50 flex items-center gap-2 animate-in slide-in-from-bottom-2 duration-200">
          <input
            type="number"
            min="0.1"
            step="any"
            value={logValue}
            onChange={e => setLogValue(e.target.value)}
            className="flex-1 min-w-0 bg-surface-2 border border-border rounded-lg px-2.5 py-1.5 text-xs text-text focus:border-accent focus:outline-none text-center"
          />
          <span className="text-[10px] text-text-muted">{unitLabel}</span>
          <button
            onClick={() => handleLog('subtract')}
            className="px-2.5 py-1.5 rounded-lg bg-danger/10 text-danger hover:bg-danger/20 transition-colors text-xs font-semibold"
          >
            Minus
          </button>
          <button
            onClick={() => handleLog('add')}
            className="px-2.5 py-1.5 rounded-lg bg-success/10 text-success hover:bg-success/20 transition-colors text-xs font-semibold"
          >
            Add
          </button>
        </div>
      )}

      {/* Expand controls for other actions */}
      <div className="mt-2.5 flex justify-end">
        <button
          onClick={() => setExpanded(v => !v)}
          className="text-[10px] font-semibold text-text-muted hover:text-text flex items-center gap-0.5 transition-colors"
        >
          {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          {expanded ? 'Hide actions' : 'More actions'}
        </button>
      </div>

      {expanded && (
        <div className="mt-2 pt-2 border-t border-border/40 flex items-center gap-2 animate-in fade-in duration-200">
          {!isComplete && (
            <button
              onClick={handleMarkComplete}
              className="flex-1 py-1.5 text-[10px] font-bold text-success bg-success/10 border border-success/20 rounded-xl hover:bg-success/20 transition-colors text-center"
            >
              ✓ Complete
            </button>
          )}
          <button
            onClick={handleArchive}
            className="flex-1 py-1.5 text-[10px] font-bold text-text-secondary bg-surface-2 border border-border rounded-xl hover:text-text hover:bg-muted transition-colors text-center"
          >
            Archive
          </button>
          <button
            onClick={() => {
              if (window.confirm('Delete this goal permanently?')) {
                deleteGoal.mutate(goal.id)
              }
            }}
            className="p-1.5 text-danger bg-danger/10 border border-danger/20 rounded-xl hover:bg-danger/20 transition-colors"
            title="Delete"
          >
            <Trash2 size={12} />
          </button>
        </div>
      )}
    </div>
  )
}
