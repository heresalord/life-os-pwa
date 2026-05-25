
import { useNotesQuery } from '../../hooks/useNotesQuery'
import { useInboxQuery } from '../../hooks/useInboxQuery'
import { useAppStore } from '../../store/useAppStore'
import { useNavigate } from 'react-router-dom'

export function NotesInboxPanel() {
  const { selectedDate } = useAppStore()
  const { data: notes = [] } = useNotesQuery(selectedDate)
  const { data: pending = [] } = useInboxQuery(false)
  const navigate = useNavigate()

  return (
    <div className="bg-surface border border-border rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-text-muted">{notes.length} note{notes.length !== 1 ? 's' : ''} today</span>
        {pending.length > 0 && (
          <button onClick={() => navigate('/inbox')} className="text-xs bg-warning/20 text-warning px-2 py-0.5 rounded-full">
            {pending.length} in inbox
          </button>
        )}
      </div>
      {notes.slice(0, 3).map(n => (
        <div key={n.id} className="flex items-center gap-2">
          <span className="text-xs text-text-muted w-12 flex-shrink-0 capitalize">{n.template ?? 'free'}</span>
          <span className="text-sm text-text truncate">{n.title}</span>
        </div>
      ))}
      {notes.length === 0 && (
        <p className="text-xs text-text-muted">No notes yet — write your morning note.</p>
      )}
    </div>
  )
}
