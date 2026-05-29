import { useState } from 'react'
import { useNotesQuery } from '../../hooks/useNotesQuery'
import { useNoteMutations } from '../../hooks/useNoteMutations'
import { useAppStore } from '../../store/useAppStore'
import { NoteCard } from '../../components/notes/NoteCard'
import { NoteEditorModal } from '../../components/notes/NoteEditorModal'
import { EmptyState } from '../../components/EmptyState'
import { FileText, Plus, Search, X } from 'lucide-react'

export function NotesPage() {
  const { selectedDate } = useAppStore()
  // Fetch ALL notes — notes are not date-scoped
  const { data: notes = [], isLoading } = useNotesQuery()
  const { addNote, deleteNote } = useNoteMutations()
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const activeNote = notes.find(n => n.id === activeNoteId) || null

  const filtered = search.trim()
    ? notes.filter(n =>
        n.title.toLowerCase().includes(search.toLowerCase()) ||
        n.content.toLowerCase().includes(search.toLowerCase())
      )
    : notes

  const handleCreateNew = () => {
    addNote.mutate(
      { title: 'Untitled Note', content: '', date: selectedDate, template: null },
      { onSuccess: (newNote) => setActiveNoteId(newNote?.id || null) }
    )
  }

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display text-text">Notes</h1>
          <p className="text-sm text-text-secondary mt-1">
            {notes.length > 0 ? `${notes.length} note${notes.length > 1 ? 's' : ''}` : 'Freewrite, reflect, or draft.'}
          </p>
        </div>
        <button
          onClick={handleCreateNew}
          className="w-10 h-10 rounded-full bg-accent/20 text-accent flex items-center justify-center hover:bg-accent/30 transition-colors"
        >
          <Plus size={20} strokeWidth={2.5} />
        </button>
      </header>

      {/* Search */}
      {notes.length > 0 && (
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search notes…"
            className="w-full bg-surface border border-border rounded-xl pl-9 pr-9 py-2.5 text-sm text-text placeholder-text-muted focus:border-accent focus:outline-none"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text">
              <X size={14} />
            </button>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center p-8">
          <div className="w-6 h-6 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
        </div>
      ) : notes.length === 0 ? (
        <EmptyState
          icon={<FileText size={40} />}
          title="No notes yet"
          message="Tap + to start your first note."
        />
      ) : filtered.length === 0 ? (
        <p className="text-sm text-text-muted text-center py-8">No notes match "{search}"</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filtered.map(note => (
            <NoteCard
              key={note.id}
              note={note as any}
              onClick={() => setActiveNoteId(note.id)}
              onDelete={(id) => deleteNote.mutate(id)}
            />
          ))}
        </div>
      )}

      <NoteEditorModal
        note={activeNote as any}
        open={!!activeNoteId}
        onOpenChange={(open) => { if (!open) setActiveNoteId(null) }}
      />
    </div>
  )
}
