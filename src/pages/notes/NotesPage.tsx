import { useState, useEffect, useRef, useMemo } from 'react'
import { useNotesQuery } from '../../hooks/useNotesQuery'
import { useNoteMutations } from '../../hooks/useNoteMutations'
import { NoteCard } from '../../components/notes/NoteCard'
import { NoteEditorModal } from '../../components/notes/NoteEditorModal'
import { RichTextToolbar } from '../../components/notes/RichTextToolbar'
import { NoteLinkAutocomplete } from '../../components/notes/NoteLinkAutocomplete'
import { TemplatePicker } from '../../components/notes/TemplatePicker'
import { EmptyState } from '../../components/EmptyState'
import { extractTags, stripTags, applyTags, collectAllTags } from '../../lib/noteTagUtils'
import {
  FileText, Plus, Search, X, Eye, Edit3,
  FolderOpen, FolderPlus, ChevronDown, ArrowUpDown,
} from 'lucide-react'
import type { Note } from '../../db/schema'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import clsx from 'clsx'

// ── Constants ────────────────────────────────────────────────────────────────
const SYSTEM_FOLDERS = ['All', 'Pinned', 'Journal', 'Templates']
const FOLDERS_KEY    = 'life-os-note-folders'
const SORT_LABELS: Record<string, string> = {
  updated:  'Last Edited',
  created:  'Created Date',
  alpha:    'Alphabetical',
  words:    'Word Count',
}

function computeWordCount(text: string) {
  const t = text.trim()
  if (!t) return 0
  return t.split(/\s+/).filter(Boolean).length
}

// ── Desktop inline editor ─────────────────────────────────────────────────────
function DesktopNoteEditor({
  note,
  allNotes,
  onOpenNote,
}: {
  note: Note
  allNotes: Note[]
  onOpenNote: (id: string) => void
}) {
  const [title, setTitle]       = useState(note.title)
  const [body, setBody]         = useState(stripTags(note.content || ''))
  const [tags, setTags]         = useState<string[]>(extractTags(note.content || ''))
  const [tagInput, setTagInput] = useState('')
  const [mode, setMode]         = useState<'write' | 'preview'>('write')
  const { updateNote } = useNoteMutations()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

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

  const wordCount = computeWordCount(body)
  const readTime  = Math.max(1, Math.round(wordCount / 200))

  // Preview: render [[Note Title]] as clickable buttons
  const renderPreviewParts = (text: string) =>
    text.split(/(\[\[.*?\]\])/g).map((part, i) => {
      const m = part.match(/^\[\[(.*?)\]\]$/)
      if (m) {
        const title = m[1]
        const linked = allNotes.find(n => n.title === title)
        return (
          <button
            key={i}
            onClick={() => linked && onOpenNote(linked.id)}
            title={linked ? `Open "${title}"` : `Note "${title}" not found`}
            className={`text-accent underline underline-offset-2 hover:text-accent/80 transition-colors ${!linked ? 'opacity-50' : ''}`}
          >
            {title}
          </button>
        )
      }
      return <ReactMarkdown key={i} remarkPlugins={[remarkGfm]}>{part}</ReactMarkdown>
    })

  return (
    <div className="flex flex-col bg-surface border border-border rounded-2xl overflow-hidden" style={{ minHeight: '60vh' }}>
      {/* Title + mode toggle */}
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

      {/* Rich text toolbar (write mode) */}
      {mode === 'write' && (
        <RichTextToolbar
          textareaRef={textareaRef}
          body={body}
          onBodyChange={b => { setBody(b); save(b) }}
        />
      )}

      {/* Editor / Preview */}
      <div className="flex-1 overflow-hidden flex flex-col bg-bg/20 relative">
        {mode === 'write' ? (
          <>
            <textarea
              ref={textareaRef}
              autoFocus
              value={body}
              onChange={e => setBody(e.target.value)}
              onBlur={e => save(e.target.value)}
              placeholder="Start writing… Markdown supported. Type [[ to link a note."
              className="flex-1 w-full bg-transparent px-6 py-5 text-text resize-none focus:outline-none font-body leading-relaxed"
              style={{ minHeight: '320px' }}
            />
            <NoteLinkAutocomplete
              textareaRef={textareaRef}
              notes={allNotes}
              body={body}
              onBodyChange={b => { setBody(b); save(b) }}
            />
          </>
        ) : (
          <div className="flex-1 overflow-y-auto px-6 py-5">
            <article className="prose prose-invert prose-p:text-text-secondary prose-headings:text-text max-w-none">
              {body
                ? <>{renderPreviewParts(body)}</>
                : <p className="text-text-muted italic">Nothing written yet.</p>
              }
            </article>
          </div>
        )}
      </div>

      {/* Footer: word count + tags */}
      <div className="flex-shrink-0 border-t border-border px-5 py-2.5 bg-surface">
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-text-muted flex-shrink-0 tabular-nums">
            {wordCount} {wordCount === 1 ? 'word' : 'words'} · {readTime} min read
          </span>
          <div className="w-px h-3 bg-border flex-shrink-0" />
          <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
            {tags.map(tag => (
              <span key={tag} className="flex items-center gap-1 px-2 py-0.5 bg-accent/10 text-accent text-xs rounded-full font-medium">
                #{tag}
                <button onClick={() => removeTag(tag)} className="text-accent/60 hover:text-danger transition-colors ml-0.5">
                  <X size={10} />
                </button>
              </span>
            ))}
            <div className="flex items-center gap-1 flex-1 min-w-[100px]">
              <input
                type="text"
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag() } }}
                placeholder={tags.length === 0 ? 'Add tags… (Enter or comma)' : 'Add tag…'}
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

export function NotesPage() {
  const { data: notes = [], isLoading } = useNotesQuery()
  const { deleteNote } = useNoteMutations()

  const [activeNoteId, setActiveNoteId]   = useState<string | null>(null)
  const [modalOpen, setModalOpen]         = useState(false)
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false)
  const [search, setSearch]               = useState('')
  const [activeTag, setActiveTag]         = useState<string | null>(null)
  const [activeFolder, setActiveFolder]   = useState('All')
  const [sortBy, setSortBy]               = useState<'updated' | 'created' | 'alpha' | 'words'>('updated')
  const [showSortMenu, setShowSortMenu]   = useState(false)
  const [customFolders, setCustomFolders] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(FOLDERS_KEY) ?? '[]') } catch { return [] }
  })
  const [newFolderInput, setNewFolderInput] = useState('')
  const [showNewFolder, setShowNewFolder]   = useState(false)
  const [folderSidebarOpen, setFolderSidebarOpen] = useState(true)

  const activeNote = (notes as Note[]).find(n => n.id === activeNoteId) || null
  const allFolders = [...SYSTEM_FOLDERS, ...customFolders]

  const allTags = collectAllTags((notes as Note[]).map(n => n.content || ''))

  // Filtered + sorted
  const filtered = useMemo(() => {
    let list = notes as Note[]

    // Folder filter
    if (activeFolder === 'Pinned') {
      list = list.filter(n => (n as any).pinned)
    } else if (activeFolder === 'Templates') {
      list = list.filter(n => (n as any).is_template)
    } else if (activeFolder !== 'All') {
      list = list.filter(n => (n as any).folder === activeFolder)
    }

    // Search
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(n =>
        n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q)
      )
    }

    // Tag filter
    if (activeTag) {
      list = list.filter(n => extractTags(n.content || '').includes(activeTag))
    }

    // Sort — pinned always first
    list = [...list].sort((a, b) => {
      const aPinned = (a as any).pinned ? 1 : 0
      const bPinned = (b as any).pinned ? 1 : 0
      if (bPinned !== aPinned) return bPinned - aPinned

      switch (sortBy) {
        case 'updated':  return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        case 'created':  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        case 'alpha':    return a.title.localeCompare(b.title)
        case 'words':    return ((b as any).word_count ?? 0) - ((a as any).word_count ?? 0)
        default:         return 0
      }
    })

    return list
  }, [notes, activeFolder, search, activeTag, sortBy])

  const handleCreateNew = () => {
    setTemplatePickerOpen(true)
  }

  const handleNoteCreated = (id: string) => {
    setActiveNoteId(id)
    if (window.innerWidth < 1024) setModalOpen(true)
  }

  const handleNoteClick = (id: string) => {
    setActiveNoteId(id)
    if (window.innerWidth < 1024) setModalOpen(true)
  }

  const addCustomFolder = () => {
    const name = newFolderInput.trim()
    if (!name || allFolders.includes(name)) { setNewFolderInput(''); setShowNewFolder(false); return }
    const next = [...customFolders, name]
    setCustomFolders(next)
    localStorage.setItem(FOLDERS_KEY, JSON.stringify(next))
    setNewFolderInput('')
    setShowNewFolder(false)
    setActiveFolder(name)
  }

  const folderIcon = (f: string) => {
    if (f === 'All')       return '📁'
    if (f === 'Pinned')    return '📌'
    if (f === 'Journal')   return '📔'
    if (f === 'Templates') return '📋'
    return '🗂️'
  }

  const folderCount = (f: string) => {
    if (f === 'All')       return (notes as Note[]).length
    if (f === 'Pinned')    return (notes as Note[]).filter(n => (n as any).pinned).length
    if (f === 'Templates') return (notes as Note[]).filter(n => (n as any).is_template).length
    return (notes as Note[]).filter(n => (n as any).folder === f).length
  }

  return (
    <div className="lg:flex lg:gap-5 lg:items-start lg:max-w-7xl">

      {/* ── Folder sidebar (desktop) ── */}
      <div className={clsx(
        'hidden lg:flex flex-col gap-1 flex-shrink-0 transition-all duration-200',
        folderSidebarOpen ? 'w-44' : 'w-10'
      )}>
        {/* Sidebar toggle */}
        <button
          onClick={() => setFolderSidebarOpen(v => !v)}
          className="flex items-center justify-center w-8 h-8 rounded-lg text-text-muted hover:text-text hover:bg-surface-2 transition-colors self-end mb-1"
          title={folderSidebarOpen ? 'Collapse folders' : 'Expand folders'}
        >
          <FolderOpen size={15} />
        </button>

        {folderSidebarOpen && (
          <>
            {allFolders.map(f => (
              <button
                key={f}
                onClick={() => setActiveFolder(f)}
                className={clsx(
                  'flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-left text-sm transition-all w-full',
                  activeFolder === f
                    ? 'bg-accent/15 text-accent font-medium'
                    : 'text-text-secondary hover:bg-surface-2 hover:text-text'
                )}
              >
                <span className="flex items-center gap-2 truncate min-w-0">
                  <span className="text-sm">{folderIcon(f)}</span>
                  <span className="truncate">{f}</span>
                </span>
                <span className="text-[10px] text-text-muted tabular-nums flex-shrink-0">{folderCount(f)}</span>
              </button>
            ))}

            {/* New folder */}
            {showNewFolder ? (
              <div className="flex items-center gap-1 px-2.5 mt-1">
                <input
                  autoFocus
                  type="text"
                  value={newFolderInput}
                  onChange={e => setNewFolderInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') addCustomFolder(); if (e.key === 'Escape') { setShowNewFolder(false); setNewFolderInput('') } }}
                  placeholder="Folder name…"
                  className="flex-1 bg-surface border border-border rounded-md px-2 py-1 text-xs text-text focus:border-accent focus:outline-none"
                />
                <button onClick={addCustomFolder} className="text-accent text-xs font-medium hover:text-accent/80">Add</button>
              </div>
            ) : (
              <button
                onClick={() => setShowNewFolder(true)}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-text-muted hover:text-text hover:bg-surface-2 transition-colors text-xs w-full mt-1"
              >
                <FolderPlus size={13} /> New folder
              </button>
            )}
          </>
        )}
      </div>

      {/* ── List pane ── */}
      <div className="flex-shrink-0 lg:w-72 space-y-3">
        {/* Header */}
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display text-text">Notes</h1>
            <p className="text-sm text-text-secondary mt-0.5">
              {(notes as Note[]).length > 0 ? `${(notes as Note[]).length} note${(notes as Note[]).length > 1 ? 's' : ''}` : 'Freewrite, reflect, or draft.'}
            </p>
          </div>
          <button
            onClick={handleCreateNew}
            className="w-10 h-10 rounded-full bg-accent/20 text-accent flex items-center justify-center hover:bg-accent/30 transition-colors"
          >
            <Plus size={20} strokeWidth={2.5} />
          </button>
        </header>

        {/* Mobile folder dropdown */}
        <div className="lg:hidden">
          <select
            value={activeFolder}
            onChange={e => setActiveFolder(e.target.value)}
            className="w-full bg-surface border border-border rounded-xl px-3 py-2 text-sm text-text focus:border-accent focus:outline-none"
          >
            {allFolders.map(f => (
              <option key={f} value={f}>{folderIcon(f)} {f} ({folderCount(f)})</option>
            ))}
          </select>
        </div>

        {/* Search */}
        {(notes as Note[]).length > 0 && (
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

        {/* Sort controls */}
        {(notes as Note[]).length > 0 && (
          <div className="relative">
            <button
              onClick={() => setShowSortMenu(v => !v)}
              className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text transition-colors"
            >
              <ArrowUpDown size={12} />
              {SORT_LABELS[sortBy]}
              <ChevronDown size={11} className={clsx('transition-transform', showSortMenu && 'rotate-180')} />
            </button>
            {showSortMenu && (
              <div className="absolute top-full left-0 mt-1 z-20 bg-surface border border-border rounded-xl shadow-2xl py-1 min-w-[160px]">
                {(Object.entries(SORT_LABELS) as [string, string][]).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => { setSortBy(key as any); setShowSortMenu(false) }}
                    className={clsx(
                      'w-full text-left px-3 py-2 text-sm transition-colors',
                      sortBy === key ? 'text-accent bg-accent/5' : 'text-text hover:bg-surface-2'
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Note list */}
        {isLoading ? (
          <div className="flex justify-center p-8">
            <div className="w-6 h-6 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
          </div>
        ) : (notes as Note[]).length === 0 ? (
          <EmptyState icon={<FileText size={40} />} title="No notes yet" message="Tap + to start your first note." />
        ) : filtered.length === 0 ? (
          <p className="text-sm text-text-muted text-center py-8">
            {activeTag ? `No notes tagged #${activeTag}` : search ? `No notes match "${search}"` : `No notes in ${activeFolder}`}
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2.5">
            {filtered.map(note => (
              <NoteCard
                key={note.id}
                note={note}
                isActive={activeNoteId === note.id}
                folders={customFolders}
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

      {/* ── Desktop inline editor ── */}
      <div className="hidden lg:block flex-1 sticky top-20">
        {activeNote
          ? <DesktopNoteEditor
              key={activeNote.id}
              note={activeNote}
              allNotes={notes as Note[]}
              onOpenNote={id => { setActiveNoteId(id) }}
            />
          : <DesktopEditorPlaceholder />
        }
      </div>

      {/* ── Modal: mobile ── */}
      <div className="lg:hidden">
        <NoteEditorModal
          note={activeNote}
          open={modalOpen}
          onOpenChange={(open) => {
            setModalOpen(open)
            if (!open) setActiveNoteId(null)
          }}
          onOpenNote={(id) => {
            setActiveNoteId(id)
            setModalOpen(true)
          }}
        />
      </div>

      {/* ── Template picker ── */}
      <TemplatePicker
        open={templatePickerOpen}
        onOpenChange={setTemplatePickerOpen}
        onNoteCreated={handleNoteCreated}
      />

      {/* Close sort menu on outside click */}
      {showSortMenu && (
        <div className="fixed inset-0 z-10" onClick={() => setShowSortMenu(false)} />
      )}
    </div>
  )
}
