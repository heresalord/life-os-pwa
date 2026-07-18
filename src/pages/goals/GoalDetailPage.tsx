import { useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ChevronLeft,
  Edit2,
  Trash2,
  Save,
  Check,
  Flame,
  Activity,
  Dumbbell,
  DollarSign,
  BookOpen,
  Briefcase,
  Users,
  Compass,
  Palette,
  Map as MapIcon,
  Calendar as CalendarIcon,
  Target as TargetIcon,
  Milestone as MilestoneIcon,
  TrendingUp,
  Clock
} from 'lucide-react'
import { useGoalQuery, useHabitLogsQuery, useMilestonesQuery } from '../../hooks/useGoalsQuery'
import { useGoalEventsQuery } from '../../hooks/useGoalEventsQuery'
import { useGoalMutations } from '../../hooks/useGoalMutations'
import { useProjectsQuery } from '../../hooks/useProjectsQuery'
import { startOfWeek, endOfWeek, eachDayOfInterval, format, subDays, parseISO } from 'date-fns'
import clsx from 'clsx'
import { haptic } from '../../lib/haptic'

const CATEGORY_ICONS: Record<string, any> = {
  Health: Activity,
  Fitness: Dumbbell,
  Finance: DollarSign,
  Learning: BookOpen,
  Career: Briefcase,
  Relationships: Users,
  Mindfulness: Compass,
  Creative: Palette,
  Travel: MapIcon,
  Routine: CalendarIcon,
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

const DAYS_OF_WEEK = [
  { label: 'S', value: 0 },
  { label: 'M', value: 1 },
  { label: 'T', value: 2 },
  { label: 'W', value: 3 },
  { label: 'T', value: 4 },
  { label: 'F', value: 5 },
  { label: 'S', value: 6 }
]

export function GoalDetailPage() {
  const { id = '' } = useParams<{ id: string }>()
  const navigate = useNavigate()

  // Queries
  const { data: goal, isLoading: goalLoading } = useGoalQuery(id)
  const { data: habitLogs = [] } = useHabitLogsQuery(id)
  const { data: milestones = [] } = useMilestonesQuery(id)
  const { data: events = [] } = useGoalEventsQuery([id])

  // Scope shared project variables
  const totalMilestones = milestones.length
  const completedMilestones = milestones.filter(m => m.completed).length

  // Mutations
  const {
    updateGoal,
    deleteGoal,
    addEvent,
    addMilestone,
    toggleMilestone,
    deleteMilestone
  } = useGoalMutations()

  // Edit form states
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editTarget, setEditTarget] = useState('10')
  const [editCategory, setEditCategory] = useState('Health')
  const [editTrackerType, setEditTrackerType] = useState<'target' | 'habit' | 'average' | 'project'>('target')
  const [editMeasurementType, setEditMeasurementType] = useState<'count' | 'currency' | 'time' | 'percentage' | 'binary'>('count')
  const [editStartDate, setEditStartDate] = useState('')
  const [editEndDate, setEditEndDate] = useState('')
  const [editHabitFreq, setEditHabitFreq] = useState<'daily' | 'weekly'>('daily')
  const [editHabitDays, setEditHabitDays] = useState<number[]>([])
  const [editState, setEditState] = useState<'active' | 'paused' | 'completed' | 'abandoned'>('active')
  const [editProjectId, setEditProjectId] = useState('')

  const { data: projects } = useProjectsQuery()
  const linkedProject = useMemo(() => projects?.find(p => p.id === goal?.project_id), [projects, goal?.project_id])

  // Log progress state (Target / Average)
  const [logVal, setLogVal] = useState('1')
  const [logNote, setLogNote] = useState('')

  // New milestone state
  const [newMilestoneTitle, setNewMilestoneTitle] = useState('')
  const [newMilestoneDueDate, setNewMilestoneDueDate] = useState('')

  // Init form values
  const startEditing = () => {
    if (!goal) return
    setEditName(goal.name)
    setEditTarget((goal.target || 10).toString())
    setEditCategory(goal.category || 'Health')
    setEditTrackerType(goal.tracker_type)
    setEditMeasurementType(goal.measurement_type)
    setEditStartDate(goal.start_date || '')
    setEditEndDate(goal.end_date || '')
    setEditState(goal.state)
    setEditProjectId(goal.project_id || '')
    if (goal.habit_schedule && typeof goal.habit_schedule === 'object') {
      const hs = goal.habit_schedule as any
      setEditHabitFreq(hs.frequency || 'daily')
      setEditHabitDays(Array.isArray(hs.days) ? hs.days : [])
    } else {
      setEditHabitFreq('daily')
      setEditHabitDays([])
    }
    setIsEditing(true)
  }

  const handleSave = async () => {
    if (!editName.trim()) return
    await updateGoal.mutateAsync({
      id: id,
      updates: {
        name: editName.trim(),
        target: editTrackerType === 'habit' ? 1 : parseFloat(editTarget) || 0,
        tracker_type: editTrackerType,
        measurement_type: editTrackerType === 'habit' ? 'binary' : editMeasurementType,
        category: editCategory,
        start_date: editStartDate || null,
        end_date: editEndDate || null,
        state: editState,
        is_completed: editState === 'completed',
        project_id: editProjectId || null,
        habit_schedule: editTrackerType === 'habit' ? {
          frequency: editHabitFreq,
          days: editHabitDays
        } : undefined
      }
    })
    setIsEditing(false)
  }

  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete this goal permanently?')) {
      deleteGoal.mutate(id)
      navigate('/goals')
    }
  }

  // Quick action logs (Target/Average)
  const handleQuickLog = (direction: 'add' | 'subtract') => {
    const val = parseFloat(logVal) || 1
    if (val <= 0) return
    haptic('success')
    addEvent.mutate({
      goal_id: id,
      date: format(new Date(), 'yyyy-MM-dd'),
      value: val,
      event_type: direction,
      note: logNote.trim() || undefined
    })
    setLogVal('1')
    setLogNote('')
  }

  // Quick milestone creation
  const handleAddMilestone = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMilestoneTitle.trim()) return
    haptic('success')
    addMilestone.mutate({
      goal_id: id,
      title: newMilestoneTitle.trim(),
      due_date: newMilestoneDueDate || undefined
    })
    setNewMilestoneTitle('')
    setNewMilestoneDueDate('')
  }

  // Process data for charts
  const progressSum = useMemo(() => {
    return events
      .filter(e => e.goal_id === id)
      .reduce((sum, e) => {
        if (e.event_type === 'add')      return sum + (e.value || 0)
        if (e.event_type === 'subtract') return sum - (e.value || 0)
        return sum
      }, 0)
  }, [events, id])

  const rollingAverage = useMemo(() => {
    const logs = events.filter(e => e.goal_id === id)
    if (!logs.length) return 0
    return Math.round((logs.reduce((sum, e) => sum + e.value, 0) / logs.length) * 10) / 10
  }, [events, id])

  const unitLabel =
    goal?.measurement_type === 'currency' ? '$'
    : goal?.measurement_type === 'time' ? 'hrs'
    : goal?.measurement_type === 'percentage' ? '%'
    : 'units'

  // Render Premium SVG Chart based on tracker type
  const renderChart = () => {
    if (!goal) return null

    const W = 500, H = 200

    if (goal.tracker_type === 'target') {
      // Cumulative Line Chart towards target
      // Sort events by date ascending
      const sortedEvents = [...events].filter(e => e.goal_id === goal.id).reverse()
      
      let runningSum = 0
      const chartPoints = sortedEvents.map((e) => {
        if (e.event_type === 'add') runningSum += e.value
        else if (e.event_type === 'subtract') runningSum -= e.value
        return { val: runningSum, date: e.date, label: format(parseISO(e.date), 'MMM d') }
      })

      if (chartPoints.length < 2) {
        return (
          <div className="flex flex-col items-center justify-center p-8 bg-surface-2 border border-dashed border-border rounded-2xl text-text-muted text-xs">
            <TrendingUp size={30} className="opacity-40 mb-2" />
            <span>Not enough logged entries yet. Add entries to see cumulative progress.</span>
          </div>
        )
      }

      const maxVal = Math.max(goal.target || 10, ...chartPoints.map(p => p.val)) * 1.15
      const getX = (index: number) => (index / (chartPoints.length - 1)) * W
      const getY = (val: number) => H - (val / maxVal) * H

      const points = chartPoints.map((p, i) => `${getX(i)},${getY(p.val)}`).join(' ')
      const targetY = getY(goal.target || 10)

      return (
        <div className="bg-surface border border-border rounded-2xl p-4.5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider">Progress Path (Cumulative)</h3>
            <span className="text-[10px] font-semibold text-text-muted">Target: {goal.target} {unitLabel}</span>
          </div>
          <div className="relative">
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-44 overflow-visible">
              {/* Target Line */}
              <line x1="0" y1={targetY} x2={W} y2={targetY} stroke="var(--theme-danger)" strokeWidth="1.5" strokeDasharray="5 5" />
              <text x={W - 10} y={targetY - 5} textAnchor="end" fill="var(--theme-danger)" className="text-[9px] font-bold">TARGET</text>

              {/* Grid Lines */}
              {[0.25, 0.5, 0.75].map((ratio, i) => {
                const y = H * ratio
                return <line key={i} x1="0" y1={y} x2={W} y2={y} stroke="var(--theme-border)" strokeWidth="0.5" strokeDasharray="4 4" />
              })}

              {/* Area Path */}
              <path
                d={`M 0,${H} ${chartPoints.map((p, i) => `L ${getX(i)},${getY(p.val)}`).join(' ')} L ${getX(chartPoints.length - 1)},${H} Z`}
                fill="var(--theme-accent)"
                fillOpacity="0.06"
              />

              {/* Progress Line */}
              <polyline points={points} fill="none" stroke="var(--theme-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

              {/* Point Circles */}
              {chartPoints.map((p, i) => (
                <circle
                  key={i}
                  cx={getX(i)}
                  cy={getY(p.val)}
                  r="4"
                  fill="var(--theme-bg)"
                  stroke="var(--theme-accent)"
                  strokeWidth="2"
                  className="cursor-pointer hover:r-5 transition-all"
                >
                  <title>{p.date}: {p.val} {unitLabel}</title>
                </circle>
              ))}
            </svg>
            {/* X Axis Labels */}
            <div className="flex justify-between text-[9px] text-text-muted mt-2 px-1">
              <span>{chartPoints[0].label}</span>
              {chartPoints.length > 2 && <span>{chartPoints[Math.floor(chartPoints.length / 2)].label}</span>}
              <span>{chartPoints[chartPoints.length - 1].label}</span>
            </div>
          </div>
        </div>
      )
    }

    if (goal.tracker_type === 'average') {
      // Rolling average daily values chart
      const sortedEvents = [...events].filter(e => e.goal_id === goal.id).reverse()

      if (sortedEvents.length < 2) {
        return (
          <div className="flex flex-col items-center justify-center p-8 bg-surface-2 border border-dashed border-border rounded-2xl text-text-muted text-xs">
            <TrendingUp size={30} className="opacity-40 mb-2" />
            <span>Not enough logged entries yet. Add entries to see rolling average chart.</span>
          </div>
        )
      }

      const maxVal = Math.max(goal.target || 10, ...sortedEvents.map(e => e.value)) * 1.15
      const getX = (index: number) => (index / (sortedEvents.length - 1)) * W
      const getY = (val: number) => H - (val / maxVal) * H

      const avgY = getY(rollingAverage)
      const targetY = getY(goal.target || 10)

      return (
        <div className="bg-surface border border-border rounded-2xl p-4.5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider">Entries & Averages</h3>
            <span className="text-[10px] font-semibold text-text-muted">Rolling Average: {rollingAverage} {unitLabel}</span>
          </div>
          <div className="relative">
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-44 overflow-visible">
              {/* Target Line */}
              <line x1="0" y1={targetY} x2={W} y2={targetY} stroke="var(--theme-danger)" strokeWidth="1" strokeDasharray="5 5" />
              <text x={10} y={targetY - 5} fill="var(--theme-danger)" className="text-[8px] font-bold">TARGET ({goal.target})</text>

              {/* Rolling Average Line */}
              <line x1="0" y1={avgY} x2={W} y2={avgY} stroke="var(--theme-success)" strokeWidth="1.5" />
              <text x={W - 10} y={avgY - 5} textAnchor="end" fill="var(--theme-success)" className="text-[8px] font-bold">CURRENT ROLLING AVG ({rollingAverage})</text>

              {/* Bars for individual logs */}
              {sortedEvents.map((e, i) => {
                const x = getX(i)
                const y = getY(e.value)
                return (
                  <rect
                    key={i}
                    x={x - 3}
                    y={y}
                    width="6"
                    height={H - y}
                    fill="var(--theme-accent)"
                    fillOpacity="0.25"
                    rx="1"
                  />
                )
              })}

              {/* Point Circles */}
              {sortedEvents.map((e, i) => (
                <circle
                  key={i}
                  cx={getX(i)}
                  cy={getY(e.value)}
                  r="3.5"
                  fill="var(--theme-accent)"
                />
              ))}
            </svg>
            <div className="flex justify-between text-[9px] text-text-muted mt-2 px-1">
              <span>{format(parseISO(sortedEvents[0].date), 'MMM d')}</span>
              {sortedEvents.length > 2 && <span>{format(parseISO(sortedEvents[Math.floor(sortedEvents.length / 2)].date), 'MMM d')}</span>}
              <span>{format(parseISO(sortedEvents[sortedEvents.length - 1].date), 'MMM d')}</span>
            </div>
          </div>
        </div>
      )
    }

    if (goal.tracker_type === 'habit') {
      // Premium Calendar Heatmap (Last 20 weeks)
      const numWeeks = 20
      const today = new Date()
      // Week starts on Mon (1)
      const start = startOfWeek(subDays(today, numWeeks * 7), { weekStartsOn: 1 })
      const end = endOfWeek(today, { weekStartsOn: 1 })
      const days = eachDayOfInterval({ start, end })

      const logsMap = new Map<string, number>(habitLogs.map(l => [l.date, l.value]))

      // Group days by week (columns)
      const weeks: Date[][] = []
      for (let i = 0; i < days.length; i += 7) {
        weeks.push(days.slice(i, i + 7))
      }

      // Parse schedule
      let freq = 'daily'
      let schDays: number[] = []
      if (goal.habit_schedule && typeof goal.habit_schedule === 'object') {
        const hs = goal.habit_schedule as any
        freq = hs.frequency || 'daily'
        schDays = Array.isArray(hs.days) ? hs.days : []
      }

      const isScheduled = (d: Date) => {
        if (freq === 'weekly') {
          if (schDays.length === 0) return true
          return schDays.includes(d.getDay())
        }
        if (schDays.length === 0) return true
        return schDays.includes(d.getDay())
      }

      return (
        <div className="bg-surface border border-border rounded-2xl p-4.5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider flex items-center gap-2">
              <Flame size={12} className="text-warning fill-warning" /> Consistency Heatmap (20 Weeks)
            </h3>
            <span className="text-[10px] font-semibold text-text-muted">Streak: {goal.habit_streak} 🔥</span>
          </div>

          <div className="overflow-x-auto pb-1 scrollbar-none flex justify-start">
            <div className="flex gap-2 flex-row">
              {/* Day Labels on left side */}
              <div className="flex flex-col gap-2 text-[9px] text-text-secondary pr-1.5 justify-between py-1">
                <span>Mon</span>
                <span>Wed</span>
                <span>Fri</span>
                <span>Sun</span>
              </div>

              {/* Grid Columns (Weeks) */}
              <div className="flex gap-2">
                {weeks.map((week, wIdx) => (
                  <div key={wIdx} className="flex flex-col gap-2">
                    {week.map((day, dIdx) => {
                      const dateStr = format(day, 'yyyy-MM-dd')
                      const value = logsMap.get(dateStr)
                      const scheduled = isScheduled(day)
                      const isFuture = day > today

                      return (
                        <div
                          key={dIdx}
                          title={`${dateStr}: ${value === 1 ? '✓ Complete' : value === 0 ? '✗ Skipped/Failed' : 'No Log'}`}
                          className={clsx(
                            'w-3.5 h-3.5 rounded-[4px] border transition-all',
                            isFuture ? 'bg-transparent border-transparent'
                            : value === 1 ? 'bg-success border-success/40'
                            : value === 0 ? 'bg-danger border-danger/40'
                            : scheduled ? 'bg-surface-2 border-border/80'
                            : 'bg-transparent border-border/20'
                          )}
                        />
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4 text-[10px] text-text-muted justify-end">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-success" />
              <span>Checked</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-danger" />
              <span>Failed</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-surface-2 border border-border" />
              <span>Scheduled</span>
            </div>
          </div>
        </div>
      )
    }

    if (goal.tracker_type === 'project') {
      // Milestone checklist timeline
      if (milestones.length === 0) {
        return (
          <div className="flex flex-col items-center justify-center p-8 bg-surface-2 border border-dashed border-border rounded-2xl text-text-muted text-xs">
            <MilestoneIcon size={30} className="opacity-40 mb-2" />
            <span>No milestones added. Add milestones below to track progress.</span>
          </div>
        )
      }

      // Timeline vertical line connecting checklist items
      return (
        <div className="bg-surface border border-border rounded-2xl p-4.5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider">Project Milestones Timeline</h3>
            <span className="text-[10px] font-semibold text-text-secondary">{completedMilestones} / {totalMilestones} Completed</span>
          </div>

          <div className="relative pl-6 space-y-6">
            {/* Connecting Vertical Line */}
            <div className="absolute left-[9px] top-1.5 bottom-1.5 w-[2px] bg-border" />

            {milestones.map((m) => {
              const checked = m.completed
              return (
                <div key={m.id} className="relative flex items-start gap-4 group">
                  {/* Timeline bullet node */}
                  <div className={clsx(
                    'absolute left-[-22px] top-1.5 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all bg-bg z-10',
                    checked ? 'border-success bg-success/15' : 'border-border'
                  )}>
                    {checked && <div className="w-1.5 h-1.5 rounded-full bg-success animate-in zoom-in duration-200" />}
                  </div>

                  <div className="flex-1 bg-surface-2/40 hover:bg-surface-2/80 border border-border/40 p-3 rounded-xl flex items-center justify-between gap-2 transition-all">
                    <div>
                      <h4 className={clsx(
                        'text-xs font-semibold text-text leading-tight',
                        checked && 'line-through text-text-muted'
                      )}>
                        {m.title}
                      </h4>
                      {m.due_date && (
                        <p className="text-[10px] text-text-secondary mt-1 flex items-center gap-1">
                          <Clock size={10} /> Due: {m.due_date}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => toggleMilestone.mutate({ id: m.id, completed: !m.completed })}
                        className={clsx(
                          'p-1 rounded-lg border text-xs font-bold transition-all',
                          checked ? 'bg-success/15 border-success/30 text-success' : 'border-border text-text-secondary hover:text-text'
                        )}
                      >
                        <Check size={14} />
                      </button>
                      <button
                        onClick={() => deleteMilestone.mutate(m.id)}
                        className="p-1 rounded-lg border border-transparent hover:border-danger/20 text-text-muted hover:text-danger transition-all opacity-0 group-hover:opacity-100"
                        title="Delete Milestone"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )
    }

    return null
  }

  if (goalLoading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
      </div>
    )
  }

  if (!goal) {
    return (
      <div className="p-8 text-center bg-surface border border-border rounded-2xl space-y-4">
        <p className="text-text-secondary text-sm">Goal not found or was deleted.</p>
        <button
          onClick={() => navigate('/goals')}
          className="px-4 py-2 bg-accent text-bg font-medium rounded-xl text-xs"
        >
          Back to Goals
        </button>
      </div>
    )
  }

  const CatIcon = CATEGORY_ICONS[goal.category || ''] || TargetIcon
  const catColor = CATEGORY_COLORS[goal.category || ''] || 'text-text-secondary bg-surface-2 border-border'

  return (
    <div className="space-y-6 lg:max-w-4xl pb-12">
      {/* Back Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/goals')}
          className="flex items-center gap-2 text-xs text-text-secondary hover:text-text font-medium py-2 px-3 bg-surface border border-border rounded-xl transition-colors shadow-sm"
        >
          <ChevronLeft size={14} /> Back to Goals
        </button>
        <div className="flex gap-2">
          {!isEditing && (
            <>
              <button
                onClick={startEditing}
                className="flex items-center gap-1 text-xs text-text-secondary hover:text-text bg-surface border border-border px-3 py-2 rounded-xl transition-colors shadow-sm"
              >
                <Edit2 size={13} /> Edit
              </button>
              <button
                onClick={handleDelete}
                className="flex items-center gap-1 text-xs text-danger bg-danger/10 hover:bg-danger/20 border border-danger/20 px-3 py-2 rounded-xl transition-colors shadow-sm"
              >
                <Trash2 size={13} /> Delete
              </button>
            </>
          )}
        </div>
      </div>

      {/* Goal Header detail card */}
      {!isEditing ? (
        <div className="bg-surface border border-border rounded-2xl p-5 shadow-[var(--shadow-card)] space-y-3 relative overflow-hidden">
          <div className="absolute right-0 top-0 w-24 h-24 bg-accent/5 rounded-full blur-xl pointer-events-none" />

          <div className="flex flex-wrap gap-2 items-center">
            <span className={clsx(
              'flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full border uppercase tracking-wider',
              catColor
            )}>
              <CatIcon size={11} />
              {goal.category || 'General'}
            </span>
            <span className="text-[10px] font-bold text-text-secondary bg-surface-2 border border-border/80 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
              {goal.tracker_type} Tracker
            </span>
            {linkedProject && (
              <span className="text-[10px] font-bold text-accent bg-accent/10 border border-accent/20 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                Project: {linkedProject.name}
              </span>
            )}
            <span className={clsx(
              'text-[10px] font-bold px-2.5 py-0.5 rounded-full border uppercase tracking-wider ml-auto',
              goal.state === 'active' ? 'bg-success/10 border-success/20 text-success'
              : goal.state === 'completed' ? 'bg-info/10 border-info/20 text-info'
              : 'bg-muted border-border text-text-muted'
            )}>
              {goal.state}
            </span>
          </div>

          <h2 className="text-xl font-display text-text">{goal.name}</h2>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-3 border-t border-border/50 text-xs">
            <div>
              <p className="text-text-secondary opacity-60">Target goal</p>
              <p className="font-semibold mt-0.5 text-text">
                {goal.target} {goal.tracker_type !== 'habit' ? unitLabel : ''}
              </p>
            </div>
            {goal.tracker_type === 'habit' && (
              <div>
                <p className="text-text-secondary opacity-60">Current streak</p>
                <p className="font-semibold mt-0.5 text-text flex items-center gap-1">
                  {goal.habit_streak} days 🔥
                </p>
              </div>
            )}
            {(goal.tracker_type === 'target' || goal.tracker_type === 'average') && (
              <div>
                <p className="text-text-secondary opacity-60">
                  {goal.tracker_type === 'average' ? 'Current Average' : 'Total Progress'}
                </p>
                <p className="font-semibold mt-0.5 text-text">
                  {goal.tracker_type === 'average' ? rollingAverage : progressSum} {unitLabel}
                </p>
              </div>
            )}
            <div>
              <p className="text-text-secondary opacity-60">Start date</p>
              <p className="font-semibold mt-0.5 text-text">{goal.start_date || 'None set'}</p>
            </div>
            <div>
              <p className="text-text-secondary opacity-60">Deadline (SMART)</p>
              <p className="font-semibold mt-0.5 text-text">{goal.end_date || 'None set'}</p>
            </div>
          </div>
        </div>
      ) : (
        /* Editable mode card */
        <div className="bg-surface border border-accent/25 rounded-2xl p-5 shadow-md space-y-4">
          <h3 className="text-sm font-semibold text-text">Editing Goal Info</h3>

          <div className="space-y-4.5">
            <div>
              <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-1">Goal Name</label>
              <input
                type="text"
                value={editName}
                onChange={e => setEditName(e.target.value)}
                className="w-full bg-surface-2 border border-border focus:border-accent rounded-xl px-3 py-2 text-sm text-text focus:outline-none transition-colors"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-1">Tracker Type</label>
                <select
                  value={editTrackerType}
                  onChange={e => setEditTrackerType(e.target.value as any)}
                  className="w-full bg-surface-2 border border-border focus:border-accent rounded-xl px-3 py-2 text-sm text-text focus:outline-none cursor-pointer"
                >
                  <option value="target">Target</option>
                  <option value="habit">Habit</option>
                  <option value="average">Average</option>
                  <option value="project">Project</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-1">Category</label>
                <select
                  value={editCategory}
                  onChange={e => setEditCategory(e.target.value)}
                  className="w-full bg-surface-2 border border-border focus:border-accent rounded-xl px-3 py-2 text-sm text-text focus:outline-none cursor-pointer"
                >
                  {Object.keys(CATEGORY_COLORS).map(catName => (
                    <option key={catName} value={catName}>{catName}</option>
                  ))}
                </select>
              </div>
            </div>

            {editTrackerType === 'habit' && (
              <div className="bg-surface-2 border border-border/80 rounded-xl p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-text">Frequency</span>
                  <div className="flex border border-border rounded-lg overflow-hidden p-0.5 bg-surface">
                    {(['daily', 'weekly'] as const).map(f => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setEditHabitFreq(f)}
                        className={`px-3 py-1 text-[11px] font-semibold rounded-md capitalize transition-colors ${
                          editHabitFreq === f ? 'bg-surface-2 text-text' : 'text-text-muted hover:text-text'
                        }`}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="block text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-2">Scheduled Days</span>
                  <div className="flex justify-between">
                    {DAYS_OF_WEEK.map(d => {
                      const active = editHabitDays.includes(d.value)
                      return (
                        <button
                          key={d.value}
                          type="button"
                          onClick={() => {
                            setEditHabitDays(prev =>
                              prev.includes(d.value) ? prev.filter(v => v !== d.value) : [...prev, d.value].sort()
                            )
                          }}
                          className={`w-7 h-7 rounded-full border text-[10px] font-bold flex items-center justify-center transition-all ${
                            active
                              ? 'bg-accent text-bg border-accent shadow-sm'
                              : 'border-border text-text-muted hover:text-text hover:border-text-secondary'
                          }`}
                        >
                          {d.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}

            {editTrackerType !== 'habit' && editTrackerType !== 'project' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-1">Target Value</label>
                  <input
                    type="number"
                    value={editTarget}
                    onChange={e => setEditTarget(e.target.value)}
                    className="w-full bg-surface-2 border border-border focus:border-accent rounded-xl px-3 py-2 text-sm text-text focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-1">Measurement Unit</label>
                  <select
                    value={editMeasurementType}
                    onChange={e => setEditMeasurementType(e.target.value as any)}
                    className="w-full bg-surface-2 border border-border focus:border-accent rounded-xl px-3 py-2 text-sm text-text focus:outline-none cursor-pointer"
                  >
                    <option value="count">Count (Numbers)</option>
                    <option value="currency">Currency ($)</option>
                    <option value="time">Time (Hours)</option>
                    <option value="percentage">Percentage (%)</option>
                  </select>
                </div>
              </div>
            )}

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-1">Start Date</label>
                <input
                  type="date"
                  value={editStartDate}
                  onChange={e => setEditStartDate(e.target.value)}
                  className="w-full bg-surface-2 border border-border focus:border-accent rounded-xl px-3 py-2 text-xs text-text focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-1">Deadline Date</label>
                <input
                  type="date"
                  value={editEndDate}
                  onChange={e => setEditEndDate(e.target.value)}
                  className="w-full bg-surface-2 border border-border focus:border-accent rounded-xl px-3 py-2 text-xs text-text focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-1">State / Status</label>
                <select
                  value={editState}
                  onChange={e => setEditState(e.target.value as any)}
                  className="w-full bg-surface-2 border border-border focus:border-accent rounded-xl px-3 py-2 text-xs text-text focus:outline-none cursor-pointer"
                >
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                  <option value="completed">Completed</option>
                  <option value="abandoned">Archived</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-1">Link to Project (optional)</label>
              <select
                value={editProjectId}
                onChange={e => setEditProjectId(e.target.value)}
                className="w-full bg-surface-2 border border-border focus:border-accent rounded-xl px-3 py-2 text-xs text-text focus:outline-none cursor-pointer"
              >
                <option value="">No Project</option>
                {projects?.filter(p => !p.archived).map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => { haptic('light'); handleSave() }}
                disabled={updateGoal.isPending}
                className="flex-1 bg-accent text-bg font-semibold rounded-xl py-2 hover:bg-accent-dim text-xs transition-colors shadow-sm"
              >
                <Save size={13} className="inline mr-1" /> Save Changes
              </button>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 border border-border rounded-xl text-text-secondary hover:text-text hover:bg-surface-2 text-xs transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Renders type-specific chart */}
      {renderChart()}

      {/* Interactive Logging Section (Target / Average) */}
      {(goal.tracker_type === 'target' || goal.tracker_type === 'average') && (
        <div className="bg-surface border border-border rounded-2xl p-5 shadow-[var(--shadow-card)] space-y-4">
          <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider">Log Progress Entry</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-1">Value to log ({unitLabel})</label>
                <input
                  type="number"
                  min="0.1"
                  step="any"
                  value={logVal}
                  onChange={e => setLogVal(e.target.value)}
                  className="w-full bg-surface-2 border border-border focus:border-accent rounded-xl px-3.5 py-2 text-sm text-text focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-1">Optional Note</label>
                <input
                  type="text"
                  placeholder="e.g. Worked out for 2 hours today"
                  value={logNote}
                  onChange={e => setLogNote(e.target.value)}
                  className="w-full bg-surface-2 border border-border focus:border-accent rounded-xl px-3.5 py-2 text-sm text-text focus:outline-none"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleQuickLog('add')}
                  className="flex-1 bg-success/15 hover:bg-success/25 border border-success/30 text-success font-semibold py-2 rounded-xl text-xs transition-all duration-200"
                >
                  + Add Progress
                </button>
                <button
                  onClick={() => handleQuickLog('subtract')}
                  className="flex-1 bg-danger/15 hover:bg-danger/25 border border-danger/30 text-danger font-semibold py-2 rounded-xl text-xs transition-all duration-200"
                >
                  - Subtract Progress
                </button>
              </div>
            </div>

            <div className="p-4 bg-surface-2/40 border border-border/60 rounded-2xl flex flex-col justify-center text-xs text-text-muted space-y-2">
              <p className="font-semibold text-text-secondary">💡 Tips for tracking:</p>
              <p>• Logging progress accumulates/adds value to target tracking goals.</p>
              <p>• Average trackers compile rolling averages of your entries over time.</p>
              <p>• Backdates and timestamps are managed automatically based on logs.</p>
            </div>
          </div>
        </div>
      )}

      {/* Interactive Milestone Config Section (Project only) */}
      {goal.tracker_type === 'project' && (
        <form onSubmit={handleAddMilestone} className="bg-surface border border-border rounded-2xl p-5 shadow-[var(--shadow-card)] space-y-4">
          <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider">Add New Milestone</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-1">Milestone Title</label>
              <input
                type="text"
                required
                placeholder="e.g. Design app screens"
                value={newMilestoneTitle}
                onChange={e => setNewMilestoneTitle(e.target.value)}
                className="w-full bg-surface-2 border border-border focus:border-accent rounded-xl px-3.5 py-2 text-sm text-text focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-1">Due date (Optional)</label>
              <input
                type="date"
                value={newMilestoneDueDate}
                onChange={e => setNewMilestoneDueDate(e.target.value)}
                className="w-full bg-surface-2 border border-border focus:border-accent rounded-xl px-3.5 py-2 text-sm text-text focus:outline-none"
              />
            </div>
          </div>
          <button
            type="submit"
            className="w-full bg-accent text-bg font-semibold py-2.5 rounded-xl text-xs hover:bg-accent-dim transition-colors"
          >
            Create Milestone
          </button>
        </form>
      )}

      {/* History Log List */}
      <div className="bg-surface border border-border rounded-2xl p-5 shadow-[var(--shadow-card)] space-y-4">
        <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider">Historical Logs</h3>

        {/* Target/Average Log list */}
        {(goal.tracker_type === 'target' || goal.tracker_type === 'average') && (
          <div className="divide-y divide-border/60">
            {events.length === 0 ? (
              <p className="text-xs text-text-muted text-center py-6">No historical events logged yet.</p>
            ) : (
              events.map(e => (
                <div key={e.id} className="py-3 flex items-center justify-between text-xs gap-3">
                  <div className="space-y-0.5">
                    <p className="font-semibold text-text">
                      {e.event_type === 'add' ? '➕ Added' : '➖ Subtracted'} {e.value} {unitLabel}
                    </p>
                    {e.note && <p className="text-text-muted italic">{e.note}</p>}
                  </div>
                  <div className="text-right text-[10px] text-text-secondary">
                    <p>{e.date}</p>
                    <p className="opacity-60">{format(parseISO(e.created_at), 'hh:mm a')}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Habit Logs list */}
        {goal.tracker_type === 'habit' && (
          <div className="divide-y divide-border/60 max-h-64 overflow-y-auto pr-1">
            {habitLogs.length === 0 ? (
              <p className="text-xs text-text-muted text-center py-6">No habit check-ins logged yet.</p>
            ) : (
              habitLogs.map(l => (
                <div key={l.id} className="py-3 flex items-center justify-between text-xs gap-3">
                  <div className="space-y-0.5">
                    <p className="font-semibold text-text">
                      {l.value === 1 ? '✓ Checked-In (Complete)' : '✗ Checked-In (Skipped/Failed)'}
                    </p>
                    {l.note && <p className="text-text-muted italic">{l.note}</p>}
                  </div>
                  <div className="text-right text-[10px] text-text-secondary flex-shrink-0">
                    <p>{l.date}</p>
                    <p className="opacity-60">{format(parseISO(l.created_at), 'hh:mm a')}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Milestones status list (Chronological complete list) */}
        {goal.tracker_type === 'project' && (
          <div className="divide-y divide-border/60">
            {milestones.length === 0 ? (
              <p className="text-xs text-text-muted text-center py-6">No milestones added yet.</p>
            ) : (
              milestones.map(m => (
                <div key={m.id} className="py-3 flex items-center justify-between text-xs gap-3">
                  <div className="space-y-0.5">
                    <p className={clsx(
                      'font-semibold text-text',
                      m.completed && 'line-through text-text-muted'
                    )}>
                      {m.title}
                    </p>
                    {m.due_date && <p className="text-[10px] text-text-secondary">Due: {m.due_date}</p>}
                  </div>
                  <div className="text-right text-[10px] text-text-secondary">
                    <p className={m.completed ? 'text-success font-semibold' : 'text-text-muted'}>
                      {m.completed ? '✓ Completed' : 'Pending'}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}
