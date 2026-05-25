
import React, { useRef, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { UpdateProgressModal } from './UpdateProgressModal'
import type { Book } from '../../db/schema'
import clsx from 'clsx'

export function BookItem({ book, onDelete }: { book: Book, onDelete: (id: string) => void }) {
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

  const pct = book.total_pages ? Math.min(Math.round(((book.current_page || 0) / book.total_pages) * 100), 100) : 0

  return (
    <div className="relative overflow-hidden rounded-xl bg-surface border border-border group">
      <div className="absolute inset-y-0 right-0 flex items-center justify-end bg-danger/20 px-4 w-full">
        <button onClick={() => onDelete(book.id)} className="p-2 text-danger hover:bg-danger/10 rounded-full transition-colors">
          <Trash2 size={18} />
        </button>
      </div>

      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className={clsx(
          "relative flex items-center gap-4 p-4 bg-surface transition-transform duration-200 ease-out",
          swiped ? "-translate-x-16" : "translate-x-0"
        )}
      >
        <div className="w-12 h-16 bg-surface-2 border border-border rounded flex-shrink-0 flex items-center justify-center">
          <span className="text-2xl opacity-40">📘</span>
        </div>

        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-sm font-medium text-text truncate">{book.title}</span>
          {book.author && <span className="text-xs text-text-secondary truncate mt-0.5">{book.author}</span>}
          
          {book.status === 'reading' && (
            <UpdateProgressModal book={book}>
              <button className="mt-2 text-left group/btn">
                <div className="flex justify-between text-[10px] text-text-muted mb-1">
                  <span className="group-hover/btn:text-accent transition-colors">Update progress</span>
                  <span>{book.current_page || 0} {book.total_pages ? `/ ${book.total_pages}` : 'pages'}</span>
                </div>
                {book.total_pages && (
                  <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
                    <div className="h-full bg-info/70 rounded-full transition-all group-hover/btn:bg-accent/70" style={{ width: `${pct}%` }} />
                  </div>
                )}
              </button>
            </UpdateProgressModal>
          )}
        </div>
      </div>
    </div>
  )
}
