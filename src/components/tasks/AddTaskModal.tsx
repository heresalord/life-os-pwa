
import React, { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Plus, X } from 'lucide-react'
import { useTaskMutations } from '../../hooks/useTaskMutations'

interface AddTaskModalProps {
  date: string
}

export function AddTaskModal({ date }: AddTaskModalProps) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [priority, setPriority] = useState<number | null>(null)
  
  const { addTask } = useTaskMutations(date)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    
    addTask.mutate({ title: title.trim(), priority, date })
    
    setTitle('')
    setPriority(null)
    setOpen(false)
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button className="w-full flex items-center justify-center gap-2 py-3 bg-surface-2 border border-dashed border-border rounded-xl text-text-secondary hover:text-text hover:border-text-muted transition-colors text-sm font-medium">
          <Plus size={18} /> Add Task
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-bg/80 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed bottom-0 left-0 right-0 z-50 bg-surface border-t border-border rounded-t-2xl p-5 shadow-2xl sm:inset-auto sm:left-1/2 sm:-translate-x-1/2 sm:top-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-md sm:rounded-2xl sm:border">
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-base font-medium text-text">New Task</Dialog.Title>
            <Dialog.Close className="text-text-muted hover:text-text transition-colors">
              <X size={18} />
            </Dialog.Close>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <input
                autoFocus
                type="text"
                placeholder="What needs to be done?"
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="w-full bg-surface-2 border border-border rounded-xl px-4 py-3 text-text placeholder-text-muted focus:border-accent focus:outline-none transition-colors"
              />
            </div>
            
            <div>
              <label className="block text-xs text-text-muted mb-2 uppercase tracking-wider">Priority (Optional)</label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriority(priority === p ? null : p)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                      priority === p 
                        ? 'bg-accent/20 border-accent text-accent' 
                        : 'bg-surface-2 border-border text-text-secondary hover:border-text-muted'
                    }`}
                  >
                    P{p}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={!title.trim() || addTask.isPending}
              className="w-full bg-accent text-bg font-medium rounded-xl py-3 mt-2 hover:bg-accent-dim transition-colors disabled:opacity-50"
            >
              {addTask.isPending ? 'Adding...' : 'Add Task'}
            </button>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
