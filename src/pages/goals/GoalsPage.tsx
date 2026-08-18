import { useState, useMemo } from 'react'
import { useGoalsQuery } from '../../hooks/useGoalsQuery'
import { useGoalMutations } from '../../hooks/useGoalMutations'
import { GoalItem } from '../../components/goals/GoalItem'
import { AddGoalModal } from '../../components/goals/AddGoalModal'
import { EmptyState } from '../../components/EmptyState'
import { GoalGridSkeleton } from '../../components/Skeleton'
import { useTranslation } from '../../i18n'
import { haptic } from '../../lib/haptic'
import { format } from 'date-fns'
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
  CheckCircle2,
  Archive,
  Clock,
} from 'lucide-react'
import { useContextualAdd } from '../../hooks/useContextualAdd'
import clsx from 'clsx'

type TrackerTypeFilter = 'all' | 'target' | 'habit' | 'average' | 'project'

const TYPE_FILTERS = [
  { value: 'all', labelKey: 'goals.all', defaultLabel: 'All', icon: Layers },
  { value: 'target', labelKey: 'goals.targets', defaultLabel: 'Targets', icon: Target },
  { value: 'habit', labelKey: 'goals.habits', defaultLabel: 'Habits', icon: Flame },
  { value: 'average', labelKey: 'goals.averages', defaultLabel: 'Averages', icon: TrendingUp },
  { value: 'project', labelKey: 'goals.projects', defaultLabel: 'Projects', icon: MilestoneIcon },
] as const

type StateFilter = 'active' | 'completed' | 'abandoned' | 'archived'

const STATE_FILTERS: { value: StateFilter; label: string; icon: React.ComponentType<any> }[] = [
  { value: 'active',    label: 'Active',       icon: Target },
  { value: 'completed', label: 'Done',         icon: CheckCircle2 },
  { value: 'abandoned', label: 'Abandoned',    icon: Archive },
  { value: 'archived',  label: 'Auto-archived',icon: Clock },
]

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
  const { t } = useTranslation()
  const [selectedType, setSelectedType] = useState<TrackerTypeFilter>('all')
  const [selectedCategory, setSelectedCategory] = useState<string>('All')
  const [stateFilter, setStateFilter] = useState<StateFilter>('active')
  const [addOpen, setAddOpen] = useState(false)

  const { data: goals = [], isLoading } = useGoalsQuery(stateFilter)
  const { addGoal } = useGoalMutations()

  // Opens only when contextual add button is actively clicked
  useContextualAdd(() => setAddOpen(true))

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
      <header className="flex items-center justify-between pb-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-text">
            {t('goals.title', 'Goals')}
          </h1>
          <p className="text-xs text-text-secondary mt-0.5">
            {t('goals.track_build_habits', 'Track, build habits, and complete milestones')}
          </p>
        </div>
        {/* State filter chips — pinned, always visible */}
        <div className="flex items-center gap-1 p-1 bg-surface-2 border border-border rounded-xl">
          {STATE_FILTERS.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              onClick={() => setStateFilter(value)}
              className={clsx(
                'flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all',
                stateFilter === value
                  ? 'bg-surface text-text shadow-sm'
                  : 'text-text-muted hover:text-text'
              )}
            >
              <Icon size={11} />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>
      </header>

      {/* Type + Category filter — merged into one scrollable row, separated by a divider */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none snap-x -mx-4 px-4 sm:mx-0 sm:px-0">
        {TYPE_FILTERS.map(filter => {
          const Icon = filter.icon
          const isSelected = selectedType === filter.value
          return (
            <button
              key={filter.value}
              onClick={() => setSelectedType(filter.value)}
              className={clsx(
                'flex items-center gap-2 px-3 py-2 rounded-full text-xs font-medium border transition-all flex-shrink-0 snap-start',
                isSelected
                  ? 'border-accent text-accent bg-accent/10 shadow-sm'
                  : 'border-border text-text-secondary bg-surface hover:text-text hover:border-text-secondary'
              )}
            >
              <Icon size={12} />
              <span>{t(filter.labelKey, filter.defaultLabel)}</span>
            </button>
          )
        })}

        <div className="w-px h-6 bg-border flex-shrink-0 mx-1" />

        {CATEGORY_CHIPS.map(cat => {
          const Icon = cat.icon
          const isSelected = selectedCategory === cat.name
          return (
            <button
              key={cat.name}
              onClick={() => setSelectedCategory(cat.name)}
              className={clsx(
                'flex items-center gap-2 px-3 py-2 rounded-full text-xs font-medium border transition-all flex-shrink-0 snap-start',
                isSelected
                  ? 'border-accent text-accent bg-accent/10 shadow-sm'
                  : 'border-border text-text-secondary bg-surface hover:text-text hover:border-text-secondary'
              )}
            >
              <Icon size={12} />
              <span>{t(`goals.categories.${cat.name}`, cat.name)}</span>
            </button>
          )
        })}
      </div>

      <AddGoalModal open={addOpen} onOpenChange={setAddOpen} />

      {isLoading ? (
        <GoalGridSkeleton count={4} />
      ) : filteredGoals.length === 0 ? (
        <div className="space-y-6">
          <EmptyState
            icon={<Target size={40} />}
            title={t('goals.no_goals_found', 'No goals found')}
            message={t('goals.try_changing_filters', 'Try changing filters or set a new goal to begin.')}
          />
          {selectedType === 'all' && selectedCategory === 'All' && stateFilter === 'active' && (
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider pl-1">Suggested Goals to Start</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { name: 'Read 15 mins daily', tracker_type: 'habit', category: 'Learning', target: 1 },
                  { name: 'Drink 2L Water', tracker_type: 'habit', category: 'Health', target: 1 },
                  { name: 'Save $1,000', tracker_type: 'target', category: 'Finance', target: 1000, measurement_type: 'currency' }
                ].map(s => (
                  <button
                    key={s.name}
                    onClick={() => {
                      haptic('success')
                      addGoal.mutate({
                        name: s.name,
                        tracker_type: s.tracker_type as any,
                        category: s.category,
                        target: s.target,
                        measurement_type: (s as any).measurement_type || 'binary',
                        start_date: format(new Date(), 'yyyy-MM-dd')
                      })
                    }}
                    className="p-4 bg-surface border border-border rounded-2xl text-left hover:bg-surface-2 transition-all shadow-[var(--shadow-card)] hover:scale-[1.02]"
                  >
                    <p className="text-xs text-text-muted uppercase tracking-wider font-semibold">{s.category}</p>
                    <p className="font-semibold text-sm text-text mt-1">{s.name}</p>
                    <p className="text-[10px] text-accent font-medium mt-2 flex items-center gap-1">
                      + Add this goal
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        // Desktop: 2-column grid; mobile: single column stack
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredGoals.map(g => (
            <GoalItem key={g.id} goal={g} />
          ))}
        </div>
      )}
    </div>
  )
}
