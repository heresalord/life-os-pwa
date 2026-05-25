
import React, { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { useBookMutations } from '../../hooks/useBookMutations'
import type { Book } from '../../db/schema'

export function UpdateProgressModal({ book, children }: { book: Book, children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const [page, setPage] = useState(book.current_page?.toString() || '0')
  const { updateBook } = useBookMutations()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const p = parseInt(page)
    if (isNaN(p)) return
    
    const isCompleted = book.total_pages && p >= book.total_pages

    updateBook.mutate({ 
      id: book.id, 
      updates: { 
        current_page: p,
        status: isCompleted ? 'completed' : book.status,
        finished_at: isCompleted ? new Date().toISOString() : book.finished_at
      } 
    })
    
    setOpen(false)
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>{children}</Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-bg/80 backdrop-blur-sm" />
        <Dialog.Content className="fixed bottom-0 left-0 right-0 z-50 bg-surface border-t border-border rounded-t-2xl p-5 shadow-2xl sm:inset-auto sm:left-1/2 sm:-translate-x-1/2 sm:top-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-md sm:rounded-2xl sm:border">
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-base font-medium text-text">Update Progress</Dialog.Title>
            <Dialog.Close className="text-text-muted hover:text-text"><X size={18} /></Dialog.Close>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <p className="text-sm text-text-secondary mb-3 truncate">{book.title}</p>
              <div className="flex items-center gap-3">
                <input autoFocus type="number" min="0" max={book.total_pages || undefined} required value={page} onChange={e => setPage(e.target.value)}
                  className="w-full bg-surface-2 border border-border rounded-xl px-4 py-3 text-text focus:border-accent focus:outline-none" />
                {book.total_pages && <span className="text-text-muted flex-shrink-0">/ {book.total_pages}</span>}
              </div>
            </div>

            <button type="submit" disabled={updateBook.isPending}
              className="w-full bg-accent text-bg font-medium rounded-xl py-3 mt-2 hover:bg-accent-dim transition-colors">
              Save Progress
            </button>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
