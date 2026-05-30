import { useState, useEffect } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X, Maximize2, Minimize2, Plus } from 'lucide-react'
import { useNoteMutations } from '../../hooks/useNoteMutations'
import type { Note } from '../../db/schema'
import { extractTags, stripTags, applyTags } from '../../lib/noteTagUtils'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export function NoteEditorModal({
  note,
  open,
  onOpenChange,
}: {
  note: Note | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [title, setTitle]       = useState('')
  const [body, setBody]         = useState('')   // content without the tag comment
  const [tags, setTags]         = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [mode, setMode]         = useState<'write' | 'preview'>('write')
  const [fullscreen, setFullscreen] = useState(false)
  const { updateNote } = useNoteMutations()

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

  if (!note) return null

  return (
    <Dialog.Root open={open} onOpenChange={(val) => { if (!val) handleClose(); else onOpenChange(true) }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-bg/90 backdrop-blur-sm" />
        <Dialog.Content className={`fixed z-50 bg-surface border border-border flex flex-col transition-all duration-300 ${
          fullscreen
            ? 'inset-0 sm:inset-4 sm:rounded-2xl'
            : 'bottom-0 left-0 right-0 top-16 rounded-t-2xl sm:inset-auto sm:left-1/2 sm:-translate-x-1/2 sm:top-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-3xl sm:h-[80vh] sm:rounded-2xl'
        }`}>

          {/* Toolbar */}
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
                <button onClick={() => setMode('write')} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${mode === 'write' ? 'bg-surface text-text shadow-sm' : 'text-text-muted hover:text-text-secondary'}`}>Write</button>
                <button onClick={() => setMode('preview')} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${mode === 'preview' ? 'bg-surface text-text shadow-sm' : 'text-text-muted hover:text-text-secondary'}`}>Preview</button>
              </div>
              <button onClick={() => setFullscreen(!fullscreen)} className="text-text-muted hover:text-text hidden sm:block">
                {fullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
              </button>
              <button onClick={handleClose} className="text-text-muted hover:text-text">
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Editor / Preview */}
          <div className="flex-1 overflow-hidden flex flex-col bg-bg/30">
            {mode === 'write' ? (
              <textarea
                autoFocus
                value={body}
                onChange={e => setBody(e.target.value)}
                onBlur={e => handleSave(e.target.value)}
                placeholder="Start writing… Markdown is supported."
                className="flex-1 w-full bg-transparent p-6 text-text resize-none focus:outline-none font-body leading-relaxed"
              />
            ) : (
              <div className="flex-1 overflow-y-auto p-6">
                <article className="prose prose-invert prose-p:text-text-secondary prose-headings:text-text max-w-none">
                  {body ? (
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{body}</ReactMarkdown>
                  ) : (
                    <p className="text-text-muted italic">Nothing written yet.</p>
                  )}
                </article>
              </div>
            )}
          </div>

          {/* Tag editor */}
          <div className="flex-shrink-0 border-t border-border px-4 py-3 bg-surface">
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
                  placeholder="Add tag…"
                  className="flex-1 bg-transparent text-xs text-text placeholder-text-muted focus:outline-none min-w-[80px]"
                />
                {tagInput.trim() && (
                  <button onClick={addTag} className="text-accent hover:text-accent-dim flex-shrink-0">
                    <Plus size={14} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
