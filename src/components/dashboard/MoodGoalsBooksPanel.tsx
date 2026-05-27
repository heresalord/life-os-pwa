import { useGoalsQuery } from '../../hooks/useGoalsQuery'
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

  const book = allBooks.find(b => b.status === 'reading')
  const bookPct = book?.total_pages ? Math.round(((book.current_page ?? 0) / book.total_pages) * 100) : 0

  return (
    <div className="bg-surface border border-border rounded-2xl p-4 space-y-4">
      {/* Mood */}
      {record?.mood ? (
        <div className="flex items-center gap-2">
          <span className="text-2xl">{MOOD_EMOJI[record.mood]}</span>
          <span className="text-sm text-text-secondary">{MOOD_LABEL[record.mood]} day</span>
        </div>
      ) : (
        <p className="text-xs text-text-muted">Mood not set today</p>
      )}

      {/* Top 3 goals */}
      {goals.length === 0 ? (
        <p className="text-xs text-text-muted">No active goals</p>
      ) : (
        goals.slice(0, 3).map(g => {
          const pct = g.target ? 0 : 0 // events summed in GoalsPage
          return (
            <div key={g.id}>
              <div className="flex justify-between text-xs text-text-muted mb-1">
                <span className="truncate">{g.name}</span>
                <span className="flex-shrink-0 ml-2">{pct}%</span>
              </div>
              <div className="h-1 bg-surface-2 rounded-full overflow-hidden">
                <div className="h-full bg-accent/50 rounded-full" style={{ width: `${pct}%` }} />
              </div>
            </div>
          )
        })
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
                <div className="h-full bg-info/60 rounded-full transition-all" style={{ width: `${bookPct}%` }} />
              </div>
              <p className="text-xs text-text-muted mt-1">{book.current_page ?? 0} / {book.total_pages} pages · {bookPct}%</p>
            </>
          ) : (
            <p className="text-xs text-text-muted mt-1">{book.current_page ?? 0} pages read</p>
          )}
        </div>
      )}
    </div>
  )
}
