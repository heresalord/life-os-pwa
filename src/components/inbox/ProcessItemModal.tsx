
import React, { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X, CheckCircle2, CalendarPlus, Archive } from 'lucide-react'
import { useInboxMutations } from '../../hooks/useInboxMutations'
import { useAppStore } from '../../store/useAppStore'
import { haptic } from '../../lib/haptic'
import type { InboxItem } from '../../db/schema'

export function ProcessItemModal({ item, children }: { item: InboxItem, children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<'options' | 'task'>('options')
  
  // Task specific state
  const [taskTitle, setTaskTitle] = useState(item.text)
  const [priority, setPriority] = useState<number | null>(null)
  
  const { processItem } = useInboxMutations()
  const { selectedDate } = useAppStore()

  const handleDoNow = () => {
    haptic('success')
    processItem.mutate({
      id: item.id,
      updates: { processed: true, processed_at: new Date().toISOString(), processed_to: 'done' }
    })
    setOpen(false)
  }

  const handleArchive = () => {
    haptic('success')
    processItem.mutate({
      id: item.id,
      updates: { processed: true, processed_at: new Date().toISOString(), archived_at: new Date().toISOString(), processed_to: 'archived' }
    })
    setOpen(false)
  }

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault()
    if (!taskTitle.trim()) return

    haptic('success')
    processItem.mutate({
      id: item.id,
      updates: { processed: true, processed_at: new Date().toISOString(), processed_to: 'task' },
      target: { type: 'task', title: taskTitle.trim(), priority, date: selectedDate }
    })
    setOpen(false)
  }

  const resetAndClose = () => {
    setOpen(false)
    setTimeout(() => {
      setMode('options')
      setTaskTitle(item.text)
      setPriority(null)
    }, 200)
  }

  return (
    <Dialog.Root open={open} onOpenChange={(val) => { if(!val) resetAndClose(); else setOpen(true) }}>
      <Dialog.Trigger asChild>{children}</Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-bg/80 backdrop-blur-sm" />
        <Dialog.Content className="fixed bottom-0 left-0 right-0 z-50 bg-surface border-t border-border rounded-t-2xl p-5 shadow-2xl sm:inset-auto sm:left-1/2 sm:-translate-x-1/2 sm:top-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-md sm:rounded-2xl sm:border">
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-base font-medium text-text">
              {mode === 'options' ? 'Process Item' : 'Create Task'}
            </Dialog.Title>
            <button onClick={resetAndClose} className="text-text-muted hover:text-text"><X size={18} /></button>
          </div>

          <div className="bg-surface-2 p-3 rounded-xl border border-border mb-6">
            <span className="text-[10px] uppercase font-medium text-text-muted mb-1 block">{item.type}</span>
            <p className="text-sm text-text leading-relaxed">{item.text}</p>
          </div>

          {mode === 'options' ? (
            <div className="space-y-3">
              <button onClick={handleDoNow} className="w-full flex items-center justify-between p-4 bg-surface border border-border rounded-xl hover:border-success/50 hover:bg-success/5 transition-all group">
                <div className="flex items-center gap-3">
                  <CheckCircle2 size={20} className="text-success" />
                  <div className="text-left">
                    <p className="text-sm font-medium text-text">Do it now</p>
                    <p className="text-xs text-text-muted">Takes less than 2 minutes</p>
                  </div>
                </div>
              </button>

              <button onClick={() => setMode('task')} className="w-full flex items-center justify-between p-4 bg-surface border border-border rounded-xl hover:border-accent/50 hover:bg-accent/5 transition-all group">
                <div className="flex items-center gap-3">
                  <CalendarPlus size={20} className="text-accent" />
                  <div className="text-left">
                    <p className="text-sm font-medium text-text">Schedule Task</p>
                    <p className="text-xs text-text-muted">Add to today's task list</p>
                  </div>
                </div>
              </button>

              <button onClick={handleArchive} className="w-full flex items-center justify-between p-4 bg-surface border border-border rounded-xl hover:border-text-muted transition-all group">
                <div className="flex items-center gap-3">
                  <Archive size={20} className="text-text-muted" />
                  <div className="text-left">
                    <p className="text-sm font-medium text-text">Archive</p>
                    <p className="text-xs text-text-muted">Save for later reference</p>
                  </div>
                </div>
              </button>
            </div>
          ) : (
            <form onSubmit={handleCreateTask} className="space-y-4 animate-in fade-in slide-in-from-right-4">
              <div>
                <label className="block text-xs text-text-muted mb-2 uppercase tracking-wider">Task Title</label>
                <input autoFocus required value={taskTitle} onChange={e => setTaskTitle(e.target.value)}
                  className="w-full bg-surface-2 border border-border rounded-xl px-4 py-3 text-text focus:border-accent focus:outline-none" />
              </div>

              <div>
                <label className="block text-xs text-text-muted mb-2 uppercase tracking-wider">Priority (Optional)</label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map(p => (
                    <button key={p} type="button" onClick={() => { haptic('light'); setPriority(priority === p ? null : p) }}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${priority === p ? 'bg-accent/20 border-accent text-accent' : 'bg-surface-2 border-border text-text-secondary hover:border-text-muted'}`}>
                      P{p}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setMode('options')} className="flex-1 bg-surface-2 text-text font-medium rounded-xl py-3 hover:bg-muted transition-colors">
                  Back
                </button>
                <button type="submit" disabled={!taskTitle.trim() || processItem.isPending} className="flex-[2] bg-accent text-bg font-medium rounded-xl py-3 hover:bg-accent-dim transition-colors disabled:opacity-50">
                  {processItem.isPending ? 'Creating...' : 'Create Task'}
                </button>
              </div>
            </form>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
