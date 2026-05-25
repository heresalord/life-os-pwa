
import React, { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Plus, X } from 'lucide-react'
import { useBookMutations } from '../../hooks/useBookMutations'

export function AddBookModal({ defaultStatus = 'want_to_read' }) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [pages, setPages] = useState('')
  const [status, setStatus] = useState(defaultStatus)
  
  const { addBook } = useBookMutations()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    
    addBook.mutate({ 
      title: title.trim(), 
      author: author.trim() || undefined,
      total_pages: pages ? parseInt(pages) : undefined,
      status 
    })
    
    setTitle('')
    setAuthor('')
    setPages('')
    setOpen(false)
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button className="w-full flex items-center justify-center gap-2 py-3 bg-surface-2 border border-dashed border-border rounded-xl text-text-secondary hover:text-text hover:border-text-muted transition-colors text-sm font-medium">
          <Plus size={18} /> Add Book
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-bg/80 backdrop-blur-sm" />
        <Dialog.Content className="fixed bottom-0 left-0 right-0 z-50 bg-surface border-t border-border rounded-t-2xl p-5 shadow-2xl sm:inset-auto sm:left-1/2 sm:-translate-x-1/2 sm:top-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-md sm:rounded-2xl sm:border">
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-base font-medium text-text">Add to Library</Dialog.Title>
            <Dialog.Close className="text-text-muted hover:text-text"><X size={18} /></Dialog.Close>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs text-text-muted mb-1.5 uppercase tracking-wider">Title</label>
              <input autoFocus required value={title} onChange={e => setTitle(e.target.value)} placeholder="Book title"
                className="w-full bg-surface-2 border border-border rounded-xl px-4 py-3 text-text focus:border-accent focus:outline-none" />
            </div>

            <div>
              <label className="block text-xs text-text-muted mb-1.5 uppercase tracking-wider">Author (Optional)</label>
              <input value={author} onChange={e => setAuthor(e.target.value)} placeholder="Author name"
                className="w-full bg-surface-2 border border-border rounded-xl px-4 py-3 text-text focus:border-accent focus:outline-none" />
            </div>

            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-xs text-text-muted mb-1.5 uppercase tracking-wider">Total Pages</label>
                <input type="number" min="1" value={pages} onChange={e => setPages(e.target.value)} placeholder="e.g. 300"
                  className="w-full bg-surface-2 border border-border rounded-xl px-4 py-3 text-text focus:border-accent focus:outline-none" />
              </div>
              <div className="flex-[2]">
                <label className="block text-xs text-text-muted mb-1.5 uppercase tracking-wider">Status</label>
                <select value={status} onChange={e => setStatus(e.target.value)}
                  className="w-full bg-surface-2 border border-border rounded-xl px-4 py-3 text-text focus:border-accent focus:outline-none appearance-none capitalize">
                  <option value="reading">Reading</option>
                  <option value="want_to_read">Want to Read</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
            </div>

            <button type="submit" disabled={!title.trim() || addBook.isPending}
              className="w-full bg-accent text-bg font-medium rounded-xl py-3 mt-2 hover:bg-accent-dim transition-colors disabled:opacity-50">
              {addBook.isPending ? 'Saving...' : 'Add Book'}
            </button>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
