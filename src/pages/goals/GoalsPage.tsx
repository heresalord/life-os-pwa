import { useState, useMemo } from 'react'
import { useGoalsQuery } from '../../hooks/useGoalsQuery'
import { GoalItem } from '../../components/goals/GoalItem'
import { AddGoalModal } from '../../components/goals/AddGoalModal'
import { EmptyState } from '../../components/EmptyState'
import {
  Target,
  Grid,
  TrendingUp,
  Flame,
  Milestone as MilestoneIcon,
  Activity,
  Dumbbell,
  DollarSign,
  BookOpen,
  Briefcase,
  Users,
  Compass,
  Palette,
  Map,
  Calendar,
  Layers,
  ChevronDown
} from 'lucide-react'
import clsx from 'clsx'

type TrackerTypeFilter = 'all' | 'target' | 'habit' | 'average' | 'project'
type StateFilter = 'active' | 'completed' | 'abandoned'

const TYPE_FILTERS = [
  { value: 'all', label: 'All', icon: Layers },
  { value: 'target', label: 'Targets', icon: Target },
  { value: 'habit', label: 'Habits', icon: Flame },
  { value: 'average', label: 'Averages', icon: TrendingUp },
  { value: 'project', label: 'Projects', icon: MilestoneIcon },
] as const

const CATEGORY_CHIPS = [
  { name: 'All', icon: Grid },
  { name: 'Health', icon: Activity },
  { name: 'Fitness', icon: Dumbbell },
  { name: 'Finance', icon: DollarSign },
  { name: 'Learning', icon: BookOpen },
  { name: 'Career', icon: Briefcase },
  { name: 'Relationships', icon: Users },
  { name: 'Mindfulness', icon: Compass },
  { name: 'Creative', icon: Palette },
  { name: 'Travel', icon: Map },
  { name: 'Routine', icon: Calendar },
]

export function GoalsPage() {
  const [selectedType, setSelectedType] = useState<TrackerTypeFilter>('all')
  const [selectedCategory, setSelectedCategory] = useState<string>('All')
  const [stateFilter, setStateFilter] = useState<StateFilter>('active')

  const { data: goals = [], isLoading } = useGoalsQuery(stateFilter)

  // Filter goals locally
  const filteredGoals = useMemo(() => {
    return goals.filter(g => {
      const typeMatch = selectedType === 'all' || g.tracker_type === selectedType
      const catMatch = selectedCategory === 'All' || g.category === selectedCategory
      return typeMatch && catMatch
    })
  }, [goals, selectedType, selectedCategory])

  return (
    <div className="space-y-5 lg:max-w-5xl">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display text-text">Goals</h1>
          <p className="text-xs text-text-muted mt-0.5">Track, build habits, and complete milestones</p>
        </div>

        {/* State Filter dropdown */}
        <div className="relative group">
          <select
            value={stateFilter}
            onChange={e => setStateFilter(e.target.value as StateFilter)}
            className="appearance-none bg-surface border border-border rounded-xl pl-3.5 pr-8 py-2 text-xs font-semibold text-text focus:outline-none focus:border-accent cursor-pointer transition-colors shadow-sm"
          >
            <option value="active">🟢 Active Goals</option>
            <option value="completed">🏆 Completed</option>
            <option value="abandoned">📦 Archived</option>
          </select>
          <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-text-muted" />
        </div>
      </header>

      {/* ── Tracker Type Filter Bar ──────────────────────────────────────────────
          Grid with 5 columns: matches style of finance/task filters */}
      <div className="grid grid-cols-5 gap-1 p-1 bg-surface-2 border border-border rounded-2xl shadow-sm">
        {TYPE_FILTERS.map(filter => {
          const Icon = filter.icon
          const isActive = selectedType === filter.value
          return (
            <button
              key={filter.value}
              onClick={() => setSelectedType(filter.value)}
              className={clsx(
                'flex items-center justify-center gap-1.5 py-2 px-1 rounded-xl transition-all duration-200 font-semibold w-full text-xs',
                isActive
                  ? 'bg-surface text-text shadow-sm'
                  : 'text-text-secondary hover:text-text'
              )}
            >
              <Icon size={14} strokeWidth={isActive ? 2.5 : 1.75} />
              <span className={clsx(
                'text-[11px] sm:text-xs',
                isActive ? 'inline' : 'hidden md:inline'
              )}>
                {filter.label}
              </span>
            </button>
          )
        })}
      </div>

      {/* ── Category Horizontal Scroller ── */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none snap-x -mx-4 px-4 sm:mx-0 sm:px-0">
        {CATEGORY_CHIPS.map(cat => {
          const Icon = cat.icon
          const isSelected = selectedCategory === cat.name
          return (
            <button
              key={cat.name}
              onClick={() => setSelectedCategory(cat.name)}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all flex-shrink-0 snap-start',
                isSelected
                  ? 'border-accent text-accent bg-accent/10 shadow-sm'
                  : 'border-border text-text-secondary bg-surface hover:text-text hover:border-text-secondary'
              )}
            >
              <Icon size={12} />
              <span>{cat.name}</span>
            </button>
          )
        })}
      </div>

      <AddGoalModal />

      {isLoading ? (
        <div className="flex justify-center p-12">
          <div className="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
        </div>
      ) : filteredGoals.length === 0 ? (
        <EmptyState
          icon={<Target size={40} />}
          title="No goals found"
          message="Try changing filters or set a new goal to begin."
        />
      ) : (
        // Desktop: 2-column grid; mobile: single column stack
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {filteredGoals.map(g => (
            <GoalItem key={g.id} goal={g} />
          ))}
        </div>
      )}
    </div>
  )
}
