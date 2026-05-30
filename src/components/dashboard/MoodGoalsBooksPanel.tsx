import { useGoalsQuery } from '../../hooks/useGoalsQuery'
import { useGoalEventsQuery } from '../../hooks/useGoalEventsQuery'
import { useBooksQuery } from '../../hooks/useBooksQuery'
import { useDailyRecord } from '../../hooks/useDailyRecord'
import { useAppStore } from '../../store/useAppStore'

const MOOD_EMOJI = ['', '😶', '😕', '😐', '🙂', '😊']
const MOOD_LABEL = ['', 'Low', 'Difficult', 'Okay', 'Good', 'Great']

export function MoodGoalsBooksPanel() {
  const { selectedDate } = useAppStore()
  const { data: record } = useDailyRecord(selectedDate)
  const { data: goals = [] } = useGoalsQuery('active')
  const { data: allBooks = [] } = useBooksQuery()

  // Fetch all goal events for the active goals so progress is real
  const goalIds = goals.map(g => g.id)
  const { data: events = [] } = useGoalEventsQuery(goalIds)

  const getProgress = (goalId: string) =>
    events
      .filter(e => e.goal_id === goalId)
      .reduce((sum, e) => {
        if (e.event_type === 'add')      return sum + (e.value || 0)
        if (e.event_type === 'subtract') return sum - (e.value || 0)
        return sum
      }, 0)

  const book = allBooks.find(b => b.status === 'reading')
  const bookPct = book?.total_pages
    ? Math.round(((book.current_page ?? 0) / book.total_pages) * 100)
    : 0

  const sortedGoals = [...goals]
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, 3)

  return (
    <div className="bg-surface border border-border rounded-2xl p-4 space-y-4">
      {/* Mood */}
      {record?.mood ? (
        <div className="flex items-center gap-2">
          <span className="text-2xl">{MOOD_EMOJI[record.mood]}</span>
          <span className="text-sm text-text-secondary">{MOOD_LABEL[record.mood]} day</span>
        </div>
      ) : (
        <p className="text-xs text-text-muted italic">Mood not logged today</p>
      )}

      {/* Top 3 active goals with real progress */}
      {goals.length === 0 ? (
        <p className="text-xs text-text-muted italic">No active goals</p>
      ) : (
        <div className="space-y-3">
          {sortedGoals.map(g => {
            const progress = getProgress(g.id)
            const pct = g.target
              ? Math.min(Math.round((progress / g.target) * 100), 100)
              : 0
            return (
              <div key={g.id}>
                <div className="flex justify-between text-xs text-text-muted mb-1">
                  <span className="truncate pr-2">{g.name}</span>
                  <span className="flex-shrink-0 tabular-nums">
                    {g.target
                      ? `${progress} / ${g.target} · ${pct}%`
                      : `${progress}`}
                  </span>
                </div>
                <div className="h-1 bg-surface-2 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-accent/60 rounded-full transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Current book */}
      {book && (
        <div className="pt-3 border-t border-border">
          <p className="text-xs text-text-muted mb-1">Currently reading</p>
          <p className="text-sm text-text font-medium truncate">{book.title}</p>
          {book.author && <p className="text-xs text-text-muted">{book.author}</p>}
          {book.total_pages ? (
            <>
              <div className="h-1 bg-surface-2 rounded-full overflow-hidden mt-2">
                <div
                  className="h-full bg-info/60 rounded-full transition-all duration-500"
                  style={{ width: `${bookPct}%` }}
                />
              </div>
              <p className="text-xs text-text-muted mt-1">
                {book.current_page ?? 0} / {book.total_pages} pages · {bookPct}%
              </p>
            </>
          ) : (
            <p className="text-xs text-text-muted mt-1">{book.current_page ?? 0} pages read</p>
          )}
        </div>
      )}
    </div>
  )
}
