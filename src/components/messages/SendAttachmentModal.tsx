import { useState } from 'react'
import { FileText, CheckSquare, Inbox, X, Search } from 'lucide-react'
import { useDb } from '../../db/DbContext'
import { useQuery } from '@tanstack/react-query'
import type { MessageAttachment, Note, Task, InboxItem } from '../../db/schema'
import {
  createNoteAttachment,
  createTaskAttachment,
  createInboxAttachment,
} from '../../lib/attachmentUtils'

interface Props {
  open: boolean
  onClose: () => void
  onSelectAttachment: (attachment: MessageAttachment) => void
}

type Category = 'notes' | 'tasks' | 'inbox'

export function SendAttachmentModal({ open, onClose, onSelectAttachment }: Props) {
  const db = useDb()
  const [activeCategory, setActiveCategory] = useState<Category>('notes')
  const [search, setSearch] = useState('')

  // Query notes (excluding PIN-locked and Journal folder by default per plan 3.1)
  const { data: notes = [] } = useQuery({
    queryKey: ['attachment_picker', 'notes'],
    enabled: open && activeCategory === 'notes',
    queryFn: async () => {
      const all = await db.notes.toArray()
      return all
        .filter(n => !n.deleted_at && !n.pin_hash && n.folder !== 'Journal')
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    },
  })

  // Query tasks
  const { data: tasks = [] } = useQuery({
    queryKey: ['attachment_picker', 'tasks'],
    enabled: open && activeCategory === 'tasks',
    queryFn: async () => {
      const all = await db.tasks.toArray()
      return all
        .filter(t => !t.completed)
        .slice(0, 50)
    },
  })

  // Query inbox items
  const { data: inboxItems = [] } = useQuery({
    queryKey: ['attachment_picker', 'inbox'],
    enabled: open && activeCategory === 'inbox',
    queryFn: async () => {
      const all = await db.inbox_items.toArray()
      return all
        .filter(i => !i.processed && !i.archived_at)
        .slice(0, 50)
    },
  })

  if (!open) return null

  const handleSelectNote = (n: Note) => {
    try {
      const attachment = createNoteAttachment(n)
      onSelectAttachment(attachment)
      onClose()
    } catch (err: unknown) {
      alert((err as Error)?.message || 'Failed to attach note')
    }
  }

  const handleSelectTask = (t: Task) => {
    const attachment = createTaskAttachment(t)
    onSelectAttachment(attachment)
    onClose()
  }

  const handleSelectInbox = (i: InboxItem) => {
    const attachment = createInboxAttachment(i)
    onSelectAttachment(attachment)
    onClose()
  }

  const filteredNotes = notes.filter(n =>
    n.title.toLowerCase().includes(search.toLowerCase())
  )
  const filteredTasks = tasks.filter(t =>
    t.title.toLowerCase().includes(search.toLowerCase())
  )
  const filteredInbox = inboxItems.filter(i =>
    i.text.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-surface border border-border rounded-3xl w-full max-w-md max-h-[80vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="text-base font-semibold text-text">Attach to Message</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-surface-2 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-2 p-3 border-b border-border bg-surface-2/40">
          <button
            onClick={() => { setActiveCategory('notes'); setSearch('') }}
            className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
              activeCategory === 'notes'
                ? 'bg-accent text-white shadow-xs'
                : 'bg-surface text-text-muted hover:text-text border border-border'
            }`}
          >
            <FileText size={13} />
            <span>Notes</span>
          </button>

          <button
            onClick={() => { setActiveCategory('tasks'); setSearch('') }}
            className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
              activeCategory === 'tasks'
                ? 'bg-accent text-white shadow-xs'
                : 'bg-surface text-text-muted hover:text-text border border-border'
            }`}
          >
            <CheckSquare size={13} />
            <span>Tasks</span>
          </button>

          <button
            onClick={() => { setActiveCategory('inbox'); setSearch('') }}
            className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
              activeCategory === 'inbox'
                ? 'bg-accent text-white shadow-xs'
                : 'bg-surface text-text-muted hover:text-text border border-border'
            }`}
          >
            <Inbox size={13} />
            <span>Inbox</span>
          </button>
        </div>

        {/* Search Filter */}
        <div className="p-3 border-b border-border/60">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-2.5 text-text-muted" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={`Search ${activeCategory}…`}
              className="w-full bg-surface-2 border border-border rounded-xl pl-8 pr-3 py-1.5 text-xs text-text placeholder:text-text-muted focus:outline-none focus:border-accent"
            />
          </div>
        </div>

        {/* Items List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
          {activeCategory === 'notes' && (
            filteredNotes.length === 0 ? (
              <div className="p-8 text-center text-xs text-text-muted">No notes found.</div>
            ) : (
              filteredNotes.map(n => (
                <button
                  key={n.id}
                  onClick={() => handleSelectNote(n)}
                  className="w-full p-3 rounded-2xl bg-surface border border-border hover:border-accent/60 hover:bg-surface-2 text-left transition-all flex flex-col gap-1"
                >
                  <span className="text-xs font-semibold text-text truncate">{n.title || 'Untitled'}</span>
                  <span className="text-[11px] text-text-muted line-clamp-1">
                    {n.content?.replace(/<[^>]*>/g, '').trim() || 'Empty'}
                  </span>
                </button>
              ))
            )
          )}

          {activeCategory === 'tasks' && (
            filteredTasks.length === 0 ? (
              <div className="p-8 text-center text-xs text-text-muted">No active tasks found.</div>
            ) : (
              filteredTasks.map(t => (
                <button
                  key={t.id}
                  onClick={() => handleSelectTask(t)}
                  className="w-full p-3 rounded-2xl bg-surface border border-border hover:border-accent/60 hover:bg-surface-2 text-left transition-all flex items-center justify-between gap-2"
                >
                  <span className="text-xs font-medium text-text truncate">{t.title}</span>
                  {t.due_date && <span className="text-[10px] text-text-muted">{t.due_date}</span>}
                </button>
              ))
            )
          )}

          {activeCategory === 'inbox' && (
            filteredInbox.length === 0 ? (
              <div className="p-8 text-center text-xs text-text-muted">No inbox items found.</div>
            ) : (
              filteredInbox.map(i => (
                <button
                  key={i.id}
                  onClick={() => handleSelectInbox(i)}
                  className="w-full p-3 rounded-2xl bg-surface border border-border hover:border-accent/60 hover:bg-surface-2 text-left transition-all flex flex-col gap-1"
                >
                  <span className="text-xs font-medium text-text truncate">{i.text}</span>
                  <span className="text-[10px] text-text-muted uppercase tracking-wider">{i.type}</span>
                </button>
              ))
            )
          )}
        </div>
      </div>
    </div>
  )
}
