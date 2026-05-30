import React, { useRef, useState } from 'react'
import { Trash2 } from 'lucide-react'
import * as Dialog from '@radix-ui/react-dialog'
import type { Note } from '../../db/schema'
import { extractTags, stripTags } from '../../lib/noteTagUtils'
import clsx from 'clsx'

export function NoteCard({
  note,
  onClick,
  onDelete,
}: {
  note: Note
  onClick: () => void
  onDelete: (id: string) => void
}) {
  const [swiped, setSwiped] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const touchStartX = useRef<number | null>(null)

  const handleTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX }
  const handleTouchMove  = (e: React.TouchEvent) => {
    if (!touchStartX.current) return
    const diff = touchStartX.current - e.touches[0].clientX
    if (diff > 50)  setSwiped(true)
    if (diff < -50) setSwiped(false)
  }
  const handleTouchEnd = () => { touchStartX.current = null }

  const tags    = extractTags(note.content)
  const snippet = stripTags(note.content).replace(/[#*`_]/g, '').slice(0, 100).trim() || 'No content'

  const confirmDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    setSwiped(false)
    setShowDeleteConfirm(true)
  }

  return (
    <>
      <div className="relative overflow-hidden rounded-xl bg-surface border border-border group cursor-pointer">
        {/* Swipe-reveal delete zone */}
        <div className="absolute inset-y-0 right-0 flex items-center justify-end bg-danger/20 px-4 w-full">
          <button onClick={confirmDelete} className="p-2 text-danger hover:bg-danger/10 rounded-full transition-colors">
            <Trash2 size={18} />
          </button>
        </div>

        <div
          onClick={onClick}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className={clsx(
            'relative flex flex-col p-4 bg-surface transition-transform duration-200 ease-out hover:bg-surface-2',
            swiped ? '-translate-x-16' : 'translate-x-0'
          )}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-text truncate pr-4">{note.title}</span>
            {note.template && (
              <span className="text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded bg-surface-2 text-text-muted border border-border flex-shrink-0">
                {note.template}
              </span>
            )}
          </div>

          <p className="text-xs text-text-secondary leading-relaxed line-clamp-2">{snippet}</p>

          {/* Tags */}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {tags.map(tag => (
                <span key={tag} className="text-[10px] px-1.5 py-0.5 bg-accent/10 text-accent rounded-full font-medium">
                  #{tag}
                </span>
              ))}
            </div>
          )}

          <div className="text-[10px] text-text-muted mt-2">
            {new Date(note.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      </div>

      {/* Delete confirmation */}
      <Dialog.Root open={showDeleteConfirm} onOpenChange={v => { if (!v) setShowDeleteConfirm(false) }}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-bg/80 backdrop-blur-sm" />
          <Dialog.Content
            className="fixed bottom-0 left-0 right-0 z-50 bg-surface border-t border-border rounded-t-2xl p-5 shadow-2xl sm:inset-auto sm:left-1/2 sm:-translate-x-1/2 sm:top-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-sm sm:rounded-2xl sm:border"
            style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
          >
            <div className="w-10 h-1 rounded-full bg-border mx-auto mb-5 sm:hidden" />
            <Dialog.Title className="text-base font-medium text-text mb-1">Delete this note?</Dialog.Title>
            <p className="text-sm text-text-secondary mb-5">
              <span className="font-medium text-text">"{note.title}"</span> will be permanently deleted.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-3 bg-surface-2 text-text font-medium rounded-xl hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => { setShowDeleteConfirm(false); onDelete(note.id) }}
                className="flex-[2] py-3 bg-danger/15 text-danger font-medium rounded-xl hover:bg-danger/25 transition-colors"
              >
                Delete
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  )
}
