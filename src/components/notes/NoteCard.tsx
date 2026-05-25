
import React, { useRef, useState } from 'react'
import { Trash2 } from 'lucide-react'
import type { Note } from '../../db/schema'
import clsx from 'clsx'

export function NoteCard({ note, onClick, onDelete }: { note: Note, onClick: () => void, onDelete: (id: string) => void }) {
  const [swiped, setSwiped] = useState(false)
  const touchStartX = useRef<number | null>(null)

  const handleTouchStart = (e: React.TouchEvent) => touchStartX.current = e.touches[0].clientX
  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartX.current) return
    const diff = touchStartX.current - e.touches[0].clientX
    if (diff > 50) setSwiped(true)
    if (diff < -50) setSwiped(false)
  }
  const handleTouchEnd = () => touchStartX.current = null

  // Snippet preview
  const snippet = note.content?.replace(/[#*`_]/g, '').slice(0, 100).trim() || 'No content'

  return (
    <div className="relative overflow-hidden rounded-xl bg-surface border border-border group cursor-pointer">
      <div className="absolute inset-y-0 right-0 flex items-center justify-end bg-danger/20 px-4 w-full">
        <button onClick={(e) => { e.stopPropagation(); onDelete(note.id) }} className="p-2 text-danger hover:bg-danger/10 rounded-full transition-colors">
          <Trash2 size={18} />
        </button>
      </div>

      <div
        onClick={onClick}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className={clsx(
          "relative flex flex-col p-4 bg-surface transition-transform duration-200 ease-out hover:bg-surface-2",
          swiped ? "-translate-x-16" : "translate-x-0"
        )}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-text truncate pr-4">{note.title}</span>
          <span className="text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded bg-surface-2 text-text-muted border border-border flex-shrink-0">
            {note.template}
          </span>
        </div>
        <p className="text-xs text-text-secondary leading-relaxed line-clamp-2">{snippet}</p>
        <div className="text-[10px] text-text-muted mt-3">
          Last updated {new Date(note.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  )
}
