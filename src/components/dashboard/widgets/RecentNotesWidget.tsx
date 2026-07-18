import { useNavigate } from 'react-router-dom'
import { FileText, ChevronRight } from 'lucide-react'
import { useNotesQuery } from '../../../hooks/useNotesQuery'
import { format } from 'date-fns'

export function RecentNotesWidget() {
  const navigate = useNavigate()
  const { data: notes = [], isLoading } = useNotesQuery()

  // Take the 3 most recent notes
  const recentNotes = notes.slice(0, 3)

  return (
    <div
      onClick={() => navigate('/notes')}
      className="bg-surface border border-border rounded-2xl p-4.5 flex flex-col h-full cursor-pointer hover:border-accent/40 hover:shadow-sm transition-all group"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <FileText size={15} className="text-accent group-hover:scale-110 transition-transform" />
          <span className="font-semibold text-text uppercase tracking-wider text-[11px]">Recent Notes</span>
        </div>
        <span className="text-[10px] text-text-muted">{notes.length} total</span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto space-y-2">
        {isLoading ? (
          <div className="flex items-center justify-center h-full py-4">
            <div className="w-5 h-5 border-2 border-accent/20 border-t-accent rounded-full animate-spin" />
          </div>
        ) : recentNotes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-4 text-center text-text-muted">
            <p className="text-xs italic">No notes created yet 📝</p>
            <p className="text-[10px] opacity-75 mt-0.5">Tap to write your first note</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {recentNotes.map(n => {
              // Try to format date
              let formattedDate = n.date
              try {
                formattedDate = format(new Date(n.date + 'T12:00:00'), 'MMM d')
              } catch { /* date formatting failed — formattedDate stays as raw date string */ }

              return (
                <div
                  key={n.id}
                  className="flex items-center justify-between p-2 bg-surface-2/60 border border-border/40 hover:bg-surface-2 rounded-xl transition-colors group/item"
                >
                  <div className="min-w-0 flex-1 mr-2">
                    <p className="text-xs text-text-secondary font-medium truncate group-hover/item:text-text transition-colors">
                      {n.title}
                    </p>
                    <p className="text-[10px] text-text-muted capitalize">
                      {formattedDate} · {n.template ?? 'quick'}
                    </p>
                  </div>
                  <ChevronRight size={12} className="text-text-muted opacity-0 group-hover/item:opacity-100 group-hover/item:translate-x-0.5 transition-all" />
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
