import { useState, useEffect, useRef } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X, Maximize2, Minimize2, Plus, ListTodo } from 'lucide-react'
import { useNoteMutations } from '../../hooks/useNoteMutations'
import { useTaskMutations } from '../../hooks/useTaskMutations'
import { useAppStore } from '../../store/useAppStore'
import { getUserLocalDate } from '../../lib/dateUtils'
import type { Note } from '../../db/schema'
import { extractTags, stripTags, applyTags, cleanTaskTitle } from '../../lib/noteTagUtils'
import { useNotesQuery } from '../../hooks/useNotesQuery'
import { RichTextToolbar } from './RichTextToolbar'
import { NoteLinkAutocomplete } from './NoteLinkAutocomplete'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { haptic } from '../../lib/haptic'

function computeWordCount(text: string) {
  const t = text.trim()
  if (!t) return 0
  return t.split(/\s+/).filter(Boolean).length
}

// Custom renderer: replace [[title]] with linked spans in preview
function NoteLinkedMarkdown({
  body,
  notes,
  onOpenNote,
}: {
  body: string
  notes: Note[]
  onOpenNote: (id: string) => void
}) {
  // Replace [[Note Title]] with a placeholder element hint
  const jsxParts = body.split(/(\[\[.*?\]\])/g).map((part, i) => {
    const m = part.match(/^\[\[(.*?)\]\]$/)
    if (m) {
      const title = m[1]
      const linked = notes.find(n => n.title === title)
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

  return <>{jsxParts}</>
}

export function NoteEditorModal({
  note,
  open,
  onOpenChange,
  onOpenNote,
}: {
  note: Note | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onOpenNote?: (id: string) => void
}) {
  const [title, setTitle]       = useState('')
  const [body, setBody]         = useState('')
  const [tags, setTags]         = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [mode, setMode]         = useState<'write' | 'preview'>('write')
  const [fullscreen, setFullscreen] = useState(false)
  const { updateNote } = useNoteMutations()
  const { data: allNotes = [] } = useNotesQuery()
  const { timezone } = useAppStore()
  const today = getUserLocalDate(timezone)
  const { addTask } = useTaskMutations(today)
  const [taskFeedback, setTaskFeedback] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false)
  const [taskTitleVal, setTaskTitleVal] = useState('')
  const [taskDateOption, setTaskDateOption] = useState<'today' | 'note' | 'custom'>('today')
  const [customDateVal, setCustomDateVal] = useState(today)
  const [hasSelection, setHasSelection] = useState(false)

  const checkSelection = () => {
    const ta = textareaRef.current
    setHasSelection(!!ta && ta.selectionStart !== ta.selectionEnd)
  }

  useEffect(() => {
    if (note && open) {
      setTitle(note.title)
      setBody(stripTags(note.content || ''))
      setTags(extractTags(note.content || ''))
      setMode('write')
    }
  }, [note, open])

  const buildContent = (b = body, t = tags) => applyTags(b, t)

  const handleSave = (b = body, t = tags) => {
    if (!note) return
    const content = buildContent(b, t)
    if (title !== note.title || content !== note.content) {
      haptic('success')
      updateNote.mutate({ id: note.id, updates: { title, content } })
    }
  }

  const handleClose = () => {
    handleSave()
    onOpenChange(false)
  }

  const addTag = () => {
    const val = tagInput.trim().toLowerCase().replace(/^#/, '')
    if (!val || tags.includes(val)) { setTagInput(''); return }
    haptic('light')
    const next = [...tags, val]
    setTags(next)
    setTagInput('')
    handleSave(body, next)
  }

  const removeTag = (tag: string) => {
    const next = tags.filter(t => t !== tag)
    setTags(next)
    handleSave(body, next)
  }

  const handleCreateTask = () => {
    const ta = textareaRef.current
    const selected = ta ? ta.value.slice(ta.selectionStart, ta.selectionEnd) : ''
    const defaultTitle = cleanTaskTitle(selected || title) || ''
    setTaskTitleVal(defaultTitle)
    setTaskDateOption('today')
    setCustomDateVal(today)
    setIsTaskModalOpen(true)
  }

  const handleSubmitTask = () => {
    const finalTitle = taskTitleVal.trim() || 'New task'
    let finalDate = today
    if (taskDateOption === 'note' && note?.date) {
      finalDate = note.date
    } else if (taskDateOption === 'custom') {
      finalDate = customDateVal
    }

    addTask.mutate({ title: finalTitle, date: finalDate })
    setTaskFeedback(finalTitle)
    setIsTaskModalOpen(false)
    setTimeout(() => setTaskFeedback(null), 2500)
  }

  const wordCount = computeWordCount(body)
  const readTime  = Math.max(1, Math.round(wordCount / 200))

  if (!note) return null

  return (
    <>
      <Dialog.Root open={open} onOpenChange={(val) => { if (!val) handleClose(); else onOpenChange(true) }}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-bg/90 backdrop-blur-sm" />
        <Dialog.Content className={`fixed z-50 bg-surface border border-border flex flex-col transition-all duration-300 ${
          fullscreen
            ? 'inset-0 sm:inset-4 sm:rounded-2xl'
            : 'bottom-0 left-0 right-0 top-16 rounded-t-2xl sm:inset-auto sm:left-1/2 sm:-translate-x-1/2 sm:top-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-3xl sm:h-[85vh] sm:rounded-2xl'
        }`}>

          {/* Header */}
          <div className="flex flex-shrink-0 items-center justify-between p-4 border-b border-border gap-3">
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              onBlur={() => handleSave()}
              className="text-lg font-display text-text bg-transparent border-none focus:outline-none flex-1 min-w-0"
              placeholder="Note Title"
            />
            <div className="flex items-center gap-2 flex-shrink-0">
              <div className="flex bg-surface-2 rounded-lg p-0.5">
                <button onClick={() => setMode('write')} className={`px-3 py-2 text-xs font-medium rounded-md transition-colors ${mode === 'write' ? 'bg-surface text-text shadow-sm' : 'text-text-muted hover:text-text-secondary'}`}>Write</button>
                <button onClick={() => setMode('preview')} className={`px-3 py-2 text-xs font-medium rounded-md transition-colors ${mode === 'preview' ? 'bg-surface text-text shadow-sm' : 'text-text-muted hover:text-text-secondary'}`}>Preview</button>
              </div>
              <button onClick={() => setFullscreen(!fullscreen)} className="text-text-muted hover:text-text hidden sm:block">
                {fullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
              </button>
              <button onClick={handleClose} className="text-text-muted hover:text-text">
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Rich text toolbar (write mode only) */}
          {mode === 'write' && (
            <div className="relative">
              <RichTextToolbar
                textareaRef={textareaRef}
                body={body}
                onBodyChange={b => { setBody(b); handleSave(b) }}
                onCreateTask={handleCreateTask}
              />
              {taskFeedback && (
                <div className="absolute top-full right-3 mt-2 z-10 flex items-center gap-2 px-2.5 py-2 bg-surface border border-accent/30 rounded-lg shadow-lg text-xs text-text animate-in fade-in slide-in-from-top-1 duration-150">
                  <ListTodo size={12} className="text-accent flex-shrink-0" />
                  <span className="truncate max-w-[200px]">Added “{taskFeedback}” to Tasks</span>
                </div>
              )}
            </div>
          )}

          {/* Editor / Preview */}
          <div className="flex-1 overflow-hidden flex flex-col bg-bg/30 relative">
            {mode === 'write' ? (
              <>
                <textarea
                  ref={textareaRef}
                  autoFocus
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  onBlur={e => handleSave(e.target.value)}
                  onSelect={checkSelection}
                  onMouseUp={checkSelection}
                  onKeyUp={checkSelection}
                  placeholder="Start writing… Markdown supported. Type [[ to link a note."
                  className="flex-1 w-full bg-transparent p-6 text-text resize-none focus:outline-none font-body leading-relaxed"
                />
                <NoteLinkAutocomplete
                  textareaRef={textareaRef}
                  notes={allNotes as Note[]}
                  body={body}
                  onBodyChange={b => { setBody(b); handleSave(b) }}
                />
              </>
            ) : (
              <div className="flex-1 overflow-y-auto p-6">
                <article className="prose prose-invert prose-p:text-text-secondary prose-headings:text-text max-w-none">
                  {body ? (
                    <NoteLinkedMarkdown
                      body={body}
                      notes={allNotes as Note[]}
                      onOpenNote={id => { onOpenNote?.(id); onOpenChange(false) }}
                    />
                  ) : (
                    <p className="text-text-muted italic">Nothing written yet.</p>
                  )}
                </article>
              </div>
            )}
          </div>

          {/* Footer: word count + tags */}
          <div className="flex-shrink-0 border-t border-border px-4 py-2.5 bg-surface">
            <div className="flex items-center gap-3">
              {/* Word count */}
              <span className="text-[11px] text-text-muted flex-shrink-0 tabular-nums">
                {wordCount} {wordCount === 1 ? 'word' : 'words'} · {readTime} min read
              </span>
              <div className="w-px h-3 bg-border flex-shrink-0" />
              {/* Tags */}
              <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
                {tags.map(tag => (
                  <span key={tag} className="flex items-center gap-1 px-2 py-0.5 bg-accent/10 text-accent text-xs rounded-full font-medium">
                    #{tag}
                    <button onClick={() => removeTag(tag)} className="text-accent/60 hover:text-danger transition-colors ml-0.5">
                      <X size={10} />
                    </button>
                  </span>
                ))}
                <div className="flex items-center gap-1 flex-1 min-w-[80px]">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={e => setTagInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag() } }}
                    placeholder="Add tag…"
                    className="flex-1 bg-transparent text-xs text-text placeholder-text-muted focus:outline-none min-w-[60px]"
                  />
                  {tagInput.trim() && (
                    <button onClick={addTag} className="text-accent hover:text-accent-dim flex-shrink-0">
                      <Plus size={14} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>

    <Dialog.Root open={isTaskModalOpen} onOpenChange={setIsTaskModalOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-bg/85 backdrop-blur-sm" />
        <Dialog.Content
          className="fixed bottom-0 left-0 right-0 z-50 bg-surface border-t border-border rounded-t-2xl p-5 shadow-2xl sm:inset-auto sm:left-1/2 sm:-translate-x-1/2 sm:top-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-md sm:rounded-2xl sm:border animate-in fade-in duration-200"
          style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
        >
          <div className="w-10 h-1 rounded-full bg-border mx-auto mb-4 sm:hidden" />
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-base font-medium text-text">Create Task from Note</Dialog.Title>
            <Dialog.Close className="text-text-muted hover:text-text"><X size={18} /></Dialog.Close>
          </div>

          <div className="space-y-4">
            {/* No selection info tip */}
            {!hasSelection && (
              <div className="text-xs bg-accent/5 border border-accent/10 rounded-xl p-3 text-text-secondary leading-relaxed">
                💡 <strong>Tip:</strong> Select any text in the editor before clicking the task icon to automatically use that text as the task title.
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-text-muted mb-2 uppercase tracking-wider">
                Task Title
              </label>
              <input
                type="text"
                value={taskTitleVal}
                onChange={e => setTaskTitleVal(e.target.value)}
                className="selectable w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-sm text-text focus:border-accent focus:outline-none"
                placeholder="Task title..."
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-muted mb-2 uppercase tracking-wider">
                Task Date
              </label>
              <div className="space-y-2">
                <label className="flex items-center gap-3 p-2.5 bg-surface-2 hover:bg-surface-3 border border-border rounded-xl cursor-pointer transition-colors text-xs font-medium text-text">
                  <input
                    type="radio"
                    name="taskDateOption"
                    checked={taskDateOption === 'today'}
                    onChange={() => setTaskDateOption('today')}
                    className="text-accent focus:ring-accent"
                  />
                  <div>
                    <p>Today</p>
                    <p className="text-[10px] text-text-muted mt-0.5">{today}</p>
                  </div>
                </label>

                {note.date && note.date !== today && (
                  <label className="flex items-center gap-3 p-2.5 bg-surface-2 hover:bg-surface-3 border border-border rounded-xl cursor-pointer transition-colors text-xs font-medium text-text">
                    <input
                      type="radio"
                      name="taskDateOption"
                      checked={taskDateOption === 'note'}
                      onChange={() => setTaskDateOption('note')}
                      className="text-accent focus:ring-accent"
                    />
                    <div>
                      <p>Use Note Date</p>
                      <p className="text-[10px] text-text-muted mt-0.5">{note.date}</p>
                    </div>
                  </label>
                )}

                <div className="flex flex-col gap-2 p-2.5 bg-surface-2 border border-border rounded-xl">
                  <label className="flex items-center gap-3 cursor-pointer text-xs font-medium text-text">
                    <input
                      type="radio"
                      name="taskDateOption"
                      checked={taskDateOption === 'custom'}
                      onChange={() => setTaskDateOption('custom')}
                      className="text-accent focus:ring-accent"
                    />
                    <span>Custom Date</span>
                  </label>
                  {taskDateOption === 'custom' && (
                    <input
                      type="date"
                      value={customDateVal}
                      onChange={e => setCustomDateVal(e.target.value)}
                      className="selectable mt-1 w-full bg-surface border border-border rounded-lg px-2.5 py-2 text-xs text-text focus:border-accent focus:outline-none"
                    />
                  )}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSubmitTask}
              className="w-full py-3 bg-accent text-bg font-semibold rounded-xl hover:bg-accent-dim transition-colors"
            >
              Create Task
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  </>
  )
}
