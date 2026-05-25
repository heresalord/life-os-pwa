
import { useGoalsQuery } from '../../hooks/useGoalsQuery'
import { useGoalEventsQuery } from '../../hooks/useGoalEventsQuery'
import { useAppStore } from '../../store/useAppStore'
import { GoalItem } from '../../components/goals/GoalItem'
import { AddGoalModal } from '../../components/goals/AddGoalModal'
import { EmptyState } from '../../components/EmptyState'
import { Target } from 'lucide-react'

export function GoalsPage() {
  const { selectedDate } = useAppStore()
  const { data: goals = [], isLoading } = useGoalsQuery('active')
  
  const goalIds = goals.map(g => g.id)
  const { data: events = [] } = useGoalEventsQuery(goalIds)

  // Simple progress calculation (just matching current selectedDate for daily goals)
  // For production, we'd calculate date boundaries for weekly/monthly
  const getProgress = (goalId: string, freq: string) => {
    // For now, simplify by checking events on the selectedDate (assumes daily for MVP)
    const goalEvents = events.filter(e => e.goal_id === goalId && e.date === selectedDate)
    return goalEvents.reduce((sum, e) => sum + (e.value || 1), 0)
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-display text-text">Goals</h1>
      </header>

      <AddGoalModal />

      {isLoading ? (
        <div className="flex justify-center p-8"><div className="w-6 h-6 border-2 border-accent/30 border-t-accent rounded-full animate-spin" /></div>
      ) : goals.length === 0 ? (
        <EmptyState
          icon={<Target size={40} />}
          title="No active goals"
          message="Set a daily, weekly, or monthly goal."
        />
      ) : (
        <div className="space-y-3">
          {goals.map(g => (
            <GoalItem key={g.id} goal={g as any} progress={getProgress(g.id, g.frequency)} date={selectedDate} />
          ))}
        </div>
      )}
    </div>
  )
}
