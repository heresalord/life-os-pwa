
import { useState } from 'react'
import { useNotesQuery } from '../../hooks/useNotesQuery'
import { useNoteMutations } from '../../hooks/useNoteMutations'
import { useAppStore } from '../../store/useAppStore'
import { NoteCard } from '../../components/notes/NoteCard'
import { NoteEditorModal } from '../../components/notes/NoteEditorModal'
import { EmptyState } from '../../components/EmptyState'
import { FileText, Plus } from 'lucide-react'

export function NotesPage() {
  const { selectedDate } = useAppStore()
  // Only query notes for the selected date to maintain the daily rhythm
  const { data: notes = [], isLoading } = useNotesQuery(selectedDate)
  const { addNote, deleteNote } = useNoteMutations()
  
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null)
  const activeNote = notes.find(n => n.id === activeNoteId) || null

  const handleCreateNew = () => {
    addNote.mutate(
      { title: 'Untitled Note', content: '', date: selectedDate, template: 'free' },
      { onSuccess: (newNote) => setActiveNoteId(newNote?.id || null) }
    )
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display text-text">Notes</h1>
          <p className="text-sm text-text-secondary mt-1">Freewrite, reflect, or draft.</p>
        </div>
        <button onClick={handleCreateNew} className="w-10 h-10 rounded-full bg-accent/20 text-accent flex items-center justify-center hover:bg-accent/30 transition-colors">
          <Plus size={20} strokeWidth={2.5} />
        </button>
      </header>

      {isLoading ? (
        <div className="flex justify-center p-8"><div className="w-6 h-6 border-2 border-accent/30 border-t-accent rounded-full animate-spin" /></div>
      ) : notes.length === 0 ? (
        <EmptyState
          icon={<FileText size={40} />}
          title="No notes for this date"
          message="Tap the + button to start freewriting."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {notes.map(note => (
            <NoteCard 
              key={note.id} 
              note={note as any} 
              onClick={() => setActiveNoteId(note.id)} 
              onDelete={(id) => deleteNote.mutate(id)} 
            />
          ))}
        </div>
      )}

      {/* Fullscreen Editor Modal */}
      <NoteEditorModal 
        note={activeNote as any} 
        open={!!activeNoteId} 
        onOpenChange={(open) => { if(!open) setActiveNoteId(null) }} 
      />
    </div>
  )
}
