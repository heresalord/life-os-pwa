import { useState, useEffect } from 'react'
import { useNotesQuery } from '../../hooks/useNotesQuery'
import { useNoteMutations } from '../../hooks/useNoteMutations'
import { useAppStore } from '../../store/useAppStore'
import { NoteCard } from '../../components/notes/NoteCard'
import { NoteEditorModal } from '../../components/notes/NoteEditorModal'
import { EmptyState } from '../../components/EmptyState'
import { extractTags, stripTags, applyTags, collectAllTags } from '../../lib/noteTagUtils'
import { FileText, Plus, Search, X, Eye, Edit3 } from 'lucide-react'
import type { Note } from '../../db/schema'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

// ── Desktop inline editor ────────────────────────────────────────────────
function DesktopNoteEditor({ note }: { note: Note }) {
  const [title, setTitle]       = useState(note.title)
  const [body, setBody]         = useState(stripTags(note.content || ''))
  const [tags, setTags]         = useState<string[]>(extractTags(note.content || ''))
  const [tagInput, setTagInput] = useState('')
  const [mode, setMode]         = useState<'write' | 'preview'>('write')
  const { updateNote } = useNoteMutations()

  useEffect(() => {
    setTitle(note.title)
    setBody(stripTags(note.content || ''))
    setTags(extractTags(note.content || ''))
    setMode('write')
  }, [note.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const save = (b = body, t = tags, ttl = title) => {
    const content = applyTags(b, t)
    if (ttl !== note.title || content !== note.content) {
      updateNote.mutate({ id: note.id, updates: { title: ttl, content } })
    }
  }

  const addTag = () => {
    const val = tagInput.trim().toLowerCase().replace(/^#/, '')
    if (!val || tags.includes(val)) { setTagInput(''); return }
    const next = [...tags, val]
    setTags(next)
    setTagInput('')
    save(body, next)
  }

  const removeTag = (tag: string) => {
    const next = tags.filter(t => t !== tag)
    setTags(next)
    save(body, next)
  }

  return (
    <div className="flex flex-col bg-surface border border-border rounded-2xl overflow-hidden" style={{ minHeight: '60vh' }}>
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-border flex-shrink-0">
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          onBlur={() => save()}
          className="text-lg font-display text-text bg-transparent border-none focus:outline-none flex-1 min-w-0"
          placeholder="Note title"
        />
        <div className="flex bg-surface-2 rounded-lg p-0.5 flex-shrink-0">
          <button onClick={() => setMode('write')} className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${mode === 'write' ? 'bg-surface text-text shadow-sm' : 'text-text-muted hover:text-text-secondary'}`}>
            <Edit3 size={12} /> Write
          </button>
          <button onClick={() => setMode('preview')} className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${mode === 'preview' ? 'bg-surface text-text shadow-sm' : 'text-text-muted hover:text-text-secondary'}`}>
            <Eye size={12} /> Preview
          </button>
        </div>
      </div>

      {/* Editor / Preview */}
      <div className="flex-1 overflow-hidden flex flex-col bg-bg/20">
        {mode === 'write' ? (
          <textarea
            autoFocus
            value={body}
            onChange={e => setBody(e.target.value)}
            onBlur={e => save(e.target.value)}
            placeholder="Start writing… Markdown is supported."
            className="flex-1 w-full bg-transparent px-6 py-5 text-text resize-none focus:outline-none font-body leading-relaxed"
            style={{ minHeight: '400px' }}
          />
        ) : (
          <div className="flex-1 overflow-y-auto px-6 py-5">
            <article className="prose prose-invert prose-p:text-text-secondary prose-headings:text-text max-w-none">
              {body
                ? <ReactMarkdown remarkPlugins={[remarkGfm]}>{body}</ReactMarkdown>
                : <p className="text-text-muted italic">Nothing written yet.</p>
              }
            </article>
          </div>
        )}
      </div>

      {/* Tag editor */}
      <div className="flex-shrink-0 border-t border-border px-5 py-3 bg-surface">
        <div className="flex flex-wrap items-center gap-1.5">
          {tags.map(tag => (
            <span key={tag} className="flex items-center gap-1 px-2 py-0.5 bg-accent/10 text-accent text-xs rounded-full font-medium">
              #{tag}
              <button onClick={() => removeTag(tag)} className="text-accent/60 hover:text-danger transition-colors ml-0.5">
                <X size={10} />
              </button>
            </span>
          ))}
          <div className="flex items-center gap-1 flex-1 min-w-[120px]">
            <input
              type="text"
              value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag() } }}
              placeholder={tags.length === 0 ? 'Add tags… (Enter or comma to confirm)' : 'Add tag…'}
              className="flex-1 bg-transparent text-xs text-text placeholder-text-muted focus:outline-none"
            />
            {tagInput.trim() && (
              <button onClick={addTag} className="text-accent hover:text-accent-dim">
                <Plus size={14} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function DesktopEditorPlaceholder() {
  return (
    <div className="flex flex-col items-center justify-center bg-surface border border-dashed border-border rounded-2xl text-center p-12" style={{ minHeight: '60vh' }}>
      <FileText size={36} className="text-text-muted mb-3" />
      <p className="text-sm font-medium text-text-secondary">Select a note to edit</p>
      <p className="text-xs text-text-muted mt-1">Or create a new one with the + button</p>
    </div>
  )
}

// ── Notes page ────────────────────────────────────────────────────────────
export function NotesPage() {
  const { selectedDate } = useAppStore()
  const { data: notes = [], isLoading } = useNotesQuery()
  const { addNote, deleteNote } = useNoteMutations()

  const [activeNoteId, setActiveNoteId] = useState<string | null>(null)
  const [modalOpen, setModalOpen]       = useState(false)
  const [search, setSearch]             = useState('')
  const [activeTag, setActiveTag]       = useState<string | null>(null)

  const activeNote = notes.find(n => n.id === activeNoteId) || null

  // Collect all tags across all notes for the filter bar
  const allTags = collectAllTags(notes.map(n => n.content || ''))

  const filtered = notes.filter(note => {
    const matchesSearch = !search.trim() ||
      note.title.toLowerCase().includes(search.toLowerCase()) ||
      note.content.toLowerCase().includes(search.toLowerCase())

    const matchesTag = !activeTag ||
      extractTags(note.content || '').includes(activeTag)

    return matchesSearch && matchesTag
  })

  const handleCreateNew = () => {
    addNote.mutate(
      { title: 'Untitled Note', content: '', date: selectedDate, template: null },
      {
        onSuccess: (newNote) => {
          if (!newNote) return
          setActiveNoteId(newNote.id)
          if (window.innerWidth < 1024) setModalOpen(true)
        },
      }
    )
  }

  const handleNoteClick = (id: string) => {
    setActiveNoteId(id)
    if (window.innerWidth < 1024) setModalOpen(true)
  }

  return (
    <div className="lg:grid lg:grid-cols-[280px_1fr] lg:gap-5 lg:items-start lg:max-w-6xl">

      {/* ── Left pane: list ── */}
      <div className="space-y-4">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display text-text">Notes</h1>
            <p className="text-sm text-text-secondary mt-0.5">
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

        {/* Tag filter bar */}
        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {allTags.map(tag => (
              <button
                key={tag}
                onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                className={`text-xs px-2.5 py-1 rounded-full font-medium transition-all ${
                  activeTag === tag
                    ? 'bg-accent text-bg'
                    : 'bg-accent/10 text-accent hover:bg-accent/20'
                }`}
              >
                #{tag}
              </button>
            ))}
            {activeTag && (
              <button onClick={() => setActiveTag(null)} className="text-xs px-2.5 py-1 rounded-full text-text-muted hover:text-text bg-surface-2 border border-border transition-colors">
                Clear
              </button>
            )}
          </div>
        )}

        {/* Note list */}
        {isLoading ? (
          <div className="flex justify-center p-8">
            <div className="w-6 h-6 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
          </div>
        ) : notes.length === 0 ? (
          <EmptyState icon={<FileText size={40} />} title="No notes yet" message="Tap + to start your first note." />
        ) : filtered.length === 0 ? (
          <p className="text-sm text-text-muted text-center py-8">
            {activeTag ? `No notes tagged #${activeTag}` : `No notes match "${search}"`}
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3">
            {filtered.map(note => (
              <NoteCard
                key={note.id}
                note={note as any}
                onClick={() => handleNoteClick(note.id)}
                onDelete={(id) => {
                  deleteNote.mutate(id)
                  if (activeNoteId === id) setActiveNoteId(null)
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Right pane: desktop inline editor ── */}
      <div className="hidden lg:block sticky top-20">
        {activeNote
          ? <DesktopNoteEditor key={activeNote.id} note={activeNote as Note} />
          : <DesktopEditorPlaceholder />
        }
      </div>

      {/* ── Modal: mobile only ── */}
      <div className="lg:hidden">
        <NoteEditorModal
          note={activeNote as any}
          open={modalOpen}
          onOpenChange={(open) => {
            setModalOpen(open)
            if (!open) setActiveNoteId(null)
          }}
        />
      </div>
    </div>
  )
}
