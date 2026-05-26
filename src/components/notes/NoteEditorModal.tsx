import { useState, useEffect } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X, Maximize2, Minimize2 } from 'lucide-react'
import { useNoteMutations } from '../../hooks/useNoteMutations'
import type { Note } from '../../db/schema'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export function NoteEditorModal({ note, open, onOpenChange }: { note: Note | null, open: boolean, onOpenChange: (open: boolean) => void }) {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [mode, setMode] = useState<'write' | 'preview'>('write')
  const [fullscreen, setFullscreen] = useState(false)
  const { updateNote } = useNoteMutations()

  useEffect(() => {
    if (note && open) {
      setTitle(note.title)
      setContent(note.content || '')
      setMode('write')
    }
  }, [note, open])

  const handleSave = () => {
    if (!note) return
    if (title !== note.title || content !== note.content) {
      updateNote.mutate({ id: note.id, updates: { title, content } })
    }
  }

  const handleClose = () => {
    handleSave()
    onOpenChange(false)
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
          <div className="flex flex-shrink-0 items-center justify-between p-4 border-b border-border">
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              onBlur={handleSave}
              className="text-lg font-display text-text bg-transparent border-none focus:outline-none focus:ring-0 flex-1 min-w-0"
              placeholder="Note Title"
            />
            <div className="flex items-center gap-3 pl-4">
              <div className="flex bg-surface-2 rounded-lg p-0.5">
                <button onClick={() => setMode('write')} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${mode === 'write' ? 'bg-surface text-text shadow-sm' : 'text-text-muted hover:text-text-secondary'}`}>Write</button>
                <button onClick={() => setMode('preview')} className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${mode === 'preview' ? 'bg-surface text-text shadow-sm' : 'text-text-muted hover:text-text-secondary'}`}>Preview</button>
              </div>
              <button onClick={() => setFullscreen(!fullscreen)} className="text-text-muted hover:text-text hidden sm:block">
                {fullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
              </button>
              <button onClick={handleClose} className="text-text-muted hover:text-text"><X size={20} /></button>
            </div>
          </div>

          <div className="flex-1 overflow-hidden flex flex-col bg-bg/30">
            {mode === 'write' ? (
              <textarea
                autoFocus
                value={content}
                onChange={e => setContent(e.target.value)}
                onBlur={handleSave}
                placeholder="Start writing... Markdown is supported."
                className="flex-1 w-full bg-transparent p-6 text-text resize-none focus:outline-none focus:ring-0 font-body leading-relaxed"
              />
            ) : (
              <div className="flex-1 overflow-y-auto p-6">
                <article className="prose prose-invert prose-p:text-text-secondary prose-headings:text-text max-w-none">
                  {content ? (
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
                  ) : (
                    <p className="text-text-muted italic">Nothing written yet.</p>
                  )}
                </article>
              </div>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
