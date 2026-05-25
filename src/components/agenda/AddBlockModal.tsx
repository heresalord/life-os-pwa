
import React, { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Plus, X } from 'lucide-react'
import { useAgendaMutations } from '../../hooks/useAgendaMutations'

const TYPES = ['focus', 'meeting', 'routine', 'break', 'other'] as const

export function AddBlockModal({ date }: { date: string }) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('10:00')
  const [type, setType] = useState<typeof TYPES[number]>('focus')
  
  const { addBlock } = useAgendaMutations(date)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || startTime >= endTime) return
    
    addBlock.mutate({ title: title.trim(), start_time: startTime, end_time: endTime, type, date })
    
    setTitle('')
    setStartTime('09:00')
    setEndTime('10:00')
    setType('focus')
    setOpen(false)
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button className="w-full flex items-center justify-center gap-2 py-3 bg-surface-2 border border-dashed border-border rounded-xl text-text-secondary hover:text-text hover:border-text-muted transition-colors text-sm font-medium">
          <Plus size={18} /> Schedule Block
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-bg/80 backdrop-blur-sm" />
        <Dialog.Content className="fixed bottom-0 left-0 right-0 z-50 bg-surface border-t border-border rounded-t-2xl p-5 shadow-2xl sm:inset-auto sm:left-1/2 sm:-translate-x-1/2 sm:top-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-md sm:rounded-2xl sm:border">
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-base font-medium text-text">New Time Block</Dialog.Title>
            <Dialog.Close className="text-text-muted hover:text-text"><X size={18} /></Dialog.Close>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs text-text-muted mb-1.5 uppercase tracking-wider">Title</label>
              <input autoFocus required value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Deep Work"
                className="w-full bg-surface-2 border border-border rounded-xl px-4 py-3 text-text focus:border-accent focus:outline-none" />
            </div>

            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-xs text-text-muted mb-1.5 uppercase tracking-wider">Start Time</label>
                <input type="time" required value={startTime} onChange={e => setStartTime(e.target.value)}
                  className="w-full bg-surface-2 border border-border rounded-xl px-4 py-3 text-text focus:border-accent focus:outline-none" />
              </div>
              <div className="flex-1">
                <label className="block text-xs text-text-muted mb-1.5 uppercase tracking-wider">End Time</label>
                <input type="time" required value={endTime} onChange={e => setEndTime(e.target.value)} min={startTime}
                  className="w-full bg-surface-2 border border-border rounded-xl px-4 py-3 text-text focus:border-accent focus:outline-none" />
              </div>
            </div>

            <div>
              <label className="block text-xs text-text-muted mb-1.5 uppercase tracking-wider">Type</label>
              <div className="flex flex-wrap gap-2">
                {TYPES.map(t => (
                  <button
                    key={t} type="button" onClick={() => setType(t)}
                    className={`px-3 py-1.5 rounded-lg text-sm capitalize font-medium border transition-colors ${type === t ? 'bg-accent/20 border-accent text-accent' : 'bg-surface-2 border-border text-text-secondary hover:border-text-muted'}`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <button type="submit" disabled={!title.trim() || startTime >= endTime || addBlock.isPending}
              className="w-full bg-accent text-bg font-medium rounded-xl py-3 mt-2 hover:bg-accent-dim transition-colors disabled:opacity-50">
              {addBlock.isPending ? 'Scheduling...' : 'Schedule Block'}
            </button>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
