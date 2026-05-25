
import React from 'react'
import { Plus } from 'lucide-react'
import { useGoalMutations } from '../../hooks/useGoalMutations'
import type { Goal } from '../../db/schema'

export function GoalItem({ goal, progress, date }: { goal: Goal, progress: number, date: string }) {
  const { addEvent, updateGoal } = useGoalMutations()
  const target = goal.target || 1
  const pct = Math.min(Math.round((progress / target) * 100), 100)
  const isComplete = progress >= target

  const handleIncrement = () => {
    addEvent.mutate({ goal_id: goal.id, date, value: 1 })
  }

  const handleArchive = () => {
    updateGoal.mutate({ id: goal.id, updates: { state: 'archived' } })
  }

  return (
    <div className="bg-surface border border-border rounded-2xl p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-medium text-text">{goal.name}</h3>
          <p className="text-xs text-text-muted capitalize">{progress} / {target} {goal.frequency}</p>
        </div>
        <div className="flex items-center gap-2">
          {!isComplete && (
            <button onClick={handleIncrement} className="w-8 h-8 rounded-full bg-accent/20 text-accent flex items-center justify-center hover:bg-accent/30 transition-colors">
              <Plus size={16} strokeWidth={2.5} />
            </button>
          )}
        </div>
      </div>

      <div className="h-2 bg-surface-2 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${isComplete ? 'bg-success' : 'bg-accent/70'}`} style={{ width: `${pct}%` }} />
      </div>

      {isComplete && (
        <div className="text-xs text-success font-medium flex items-center justify-between">
          <span>Goal met! 🎉</span>
          <button onClick={handleArchive} className="text-text-muted hover:text-text transition-colors">Archive</button>
        </div>
      )}
    </div>
  )
}
