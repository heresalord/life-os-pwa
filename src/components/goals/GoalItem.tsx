import { useState, useRef, useEffect } from 'react'
import { Plus, Minus, ChevronDown, ChevronUp, Check, Archive, Flame, Trash2 } from 'lucide-react'
import { useGoalMutations } from '../../hooks/useGoalMutations'
import { haptic } from '../../lib/haptic'
import type { Goal } from '../../db/schema'
import clsx from 'clsx'

function MiniProgressRing({ pct, size = 40 }: { pct: number; size?: number }) {
  const r = (size - 6) / 2
  const circ = 2 * Math.PI * r
  const offset = circ - (pct / 100) * circ
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--theme-surface-2)" strokeWidth={5} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={pct >= 100 ? 'var(--theme-success)' : 'var(--theme-accent)'}
        strokeWidth={5}
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className="transition-all duration-700 ease-out"
      />
    </svg>
  )
}

export function GoalItem({ goal, progress, date }: { goal: Goal; progress: number; date: string }) {
  const { addEvent, updateGoal, deleteGoal } = useGoalMutations()
  const [expanded, setExpanded] = useState(false)
  const [logValue, setLogValue] = useState('1')
  const [showLog, setShowLog] = useState(false)
  const [justCompleted, setJustCompleted] = useState(false)
  const [confettiDots, setConfettiDots] = useState<{ id: number; color: string; angle: number }[]>([])
  const prevPct = useRef(0)

  const target = goal.target || 1
  const pct = Math.min(Math.round((progress / target) * 100), 100)
  const isComplete = progress >= target

  // Fire confetti when goal just crossed 100%
  useEffect(() => {
    if (pct >= 100 && prevPct.current < 100) {
      haptic('success')
      setJustCompleted(true)
      const colors = ['var(--theme-success)', 'var(--theme-accent)', 'var(--theme-warning)', '#f472b6']
      setConfettiDots(
        Array.from({ length: 8 }, (_, i) => ({
          id: Date.now() + i,
          color: colors[i % colors.length],
          angle: (i / 8) * 360,
        }))
      )
      setTimeout(() => { setJustCompleted(false); setConfettiDots([]) }, 800)
    }
    prevPct.current = pct
  }, [pct])

  const unitLabel =
    goal.measurement_type === 'currency' && goal.currency ? goal.currency
    : goal.measurement_type === 'time' ? 'hrs'
    : goal.measurement_type === 'percentage' ? '%'
    : ''

  const goalTypeBadge = goal.goal_type === 'year' ? '📅 Year' : goal.goal_type === 'binary' ? '✓ Binary' : '🎯 General'

  const handleLog = (direction: 'add' | 'subtract') => {
    const val = parseFloat(logValue) || 1
    if (val <= 0) return
    haptic('medium')
    addEvent.mutate({ goal_id: goal.id, date, value: val, event_type: direction })
    setShowLog(false)
  }

  const handleMarkComplete = () => {
    updateGoal.mutate({ id: goal.id, updates: { is_completed: true, state: 'completed' } })
  }

  const handleArchive = () => {
    updateGoal.mutate({ id: goal.id, updates: { state: 'abandoned' } })
  }

  return (
    <div className={clsx(
      'bg-surface border rounded-2xl overflow-hidden transition-all duration-300',
      isComplete ? 'border-success/40' : 'border-border'
    )}>
      {/* Main row */}
      <div className="p-4 flex items-center gap-3">
        {/* Progress ring + confetti */}
        <div className="relative flex-shrink-0">
          <div className={justCompleted ? 'goal-complete-ring' : ''}>
            <MiniProgressRing pct={pct} size={44} />
          </div>
          <span className="absolute inset-0 flex items-center justify-center text-[9px] font-semibold text-text-secondary rotate-0">
            {pct}%
          </span>
          {confettiDots.map(dot => (
            <span
              key={dot.id}
              className="confetti-dot"
              style={{
                backgroundColor: dot.color,
                left: `calc(50% + ${Math.cos((dot.angle * Math.PI) / 180) * 20}px)`,
                top:  `calc(50% + ${Math.sin((dot.angle * Math.PI) / 180) * 20}px)`,
                animationDelay: `${(dot.angle / 360) * 80}ms`,
              }}
            />
          ))}
        </div>

        {/* Name + stats */}
        <div className="flex-1 min-w-0" onClick={() => setExpanded(v => !v)}>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium text-text leading-tight truncate">{goal.name}</h3>
            {isComplete && (
              <span className="flex-shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-success/15 text-success">
                DONE
              </span>
            )}
          </div>
          <p className="text-xs text-text-muted mt-0.5">
            {progress.toLocaleString()} / {target.toLocaleString()} {unitLabel}
            <span className="mx-1.5 opacity-40">·</span>
            <span className="opacity-70">{goalTypeBadge}</span>
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {!isComplete && (
            <>
              <button
                onClick={() => setShowLog(v => !v)}
                className="w-8 h-8 rounded-full bg-accent/15 text-accent flex items-center justify-center hover:bg-accent/25 transition-colors"
                title="Log progress"
              >
                <Flame size={15} strokeWidth={2} />
              </button>
            </>
          )}
          <button
            onClick={() => setExpanded(v => !v)}
            className="w-8 h-8 rounded-full bg-surface-2 text-text-muted flex items-center justify-center hover:text-text transition-colors"
          >
            {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="px-4 pb-1">
        <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
          <div
            className={clsx(
              'h-full rounded-full transition-all duration-700 ease-out',
              isComplete ? 'bg-success' : 'bg-accent/70'
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Log value panel */}
      {showLog && (
        <div className="px-4 pb-3 pt-2 border-t border-border/50 flex items-center gap-2 bg-surface-2/50">
          <span className="text-xs text-text-muted flex-shrink-0">Log</span>
          <input
            type="number"
            min="0.1"
            step="0.1"
            value={logValue}
            onChange={e => setLogValue(e.target.value)}
            className="flex-1 min-w-0 bg-surface border border-border rounded-lg px-3 py-1.5 text-sm text-text focus:border-accent focus:outline-none text-center"
          />
          <span className="text-xs text-text-muted flex-shrink-0">{unitLabel}</span>
          <button
            onClick={() => handleLog('subtract')}
            className="w-8 h-8 rounded-full bg-danger/10 text-danger flex items-center justify-center hover:bg-danger/20 transition-colors"
            title="Subtract"
          >
            <Minus size={14} />
          </button>
          <button
            onClick={() => handleLog('add')}
            className="w-8 h-8 rounded-full bg-success/10 text-success flex items-center justify-center hover:bg-success/20 transition-colors"
            title="Add"
          >
            <Plus size={14} />
          </button>
        </div>
      )}

      {/* Expanded section */}
      {expanded && (
        <div className="border-t border-border/50 px-4 py-3 space-y-3 bg-surface-2/30">
          {/* Dates */}
          {(goal.start_date || goal.end_date) && (
            <div className="flex gap-4 text-xs text-text-muted">
              {goal.start_date && <span>Start: <span className="text-text">{goal.start_date}</span></span>}
              {goal.end_date && <span>End: <span className="text-text">{goal.end_date}</span></span>}
            </div>
          )}

          {/* Sub-goals */}
          {Array.isArray(goal.sub_goals) && (goal.sub_goals as any[]).length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs text-text-muted font-medium uppercase tracking-wider">Sub-goals</p>
              {(goal.sub_goals as any[]).map((sg: any, i: number) => (
                <div key={i} className="flex items-center gap-2 text-xs text-text bg-surface rounded-lg px-3 py-2 border border-border/50">
                  <div className={clsx(
                    'w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 transition-colors',
                    sg.completed ? 'bg-success border-success' : 'border-border'
                  )}>
                    {sg.completed && <Check size={9} strokeWidth={3} className="text-bg" />}
                  </div>
                  <span className={sg.completed ? 'line-through text-text-muted' : ''}>{sg.title || sg.name}</span>
                </div>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            {!isComplete && (
              <button
                onClick={handleMarkComplete}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-success bg-success/10 border border-success/20 rounded-xl hover:bg-success/20 transition-colors"
              >
                <Check size={13} /> Mark Complete
              </button>
            )}
            <button
              onClick={handleArchive}
              className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-text-muted bg-surface border border-border rounded-xl hover:text-text hover:bg-muted transition-colors"
            >
              <Archive size={13} /> Archive
            </button>
            <button
              onClick={() => deleteGoal.mutate(goal.id)}
              className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-danger bg-danger/10 border border-danger/20 rounded-xl hover:bg-danger/20 transition-colors ml-auto"
            >
              <Trash2 size={13} /> Delete
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
