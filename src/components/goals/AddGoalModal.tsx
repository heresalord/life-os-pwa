
import React, { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Plus, X } from 'lucide-react'
import { useGoalMutations } from '../../hooks/useGoalMutations'

export function AddGoalModal() {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [target, setTarget] = useState('1')
  const [frequency, setFrequency] = useState('daily')
  
  const { addGoal } = useGoalMutations()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !target) return
    
    addGoal.mutate({ name: name.trim(), target: parseInt(target), frequency })
    
    setName('')
    setTarget('1')
    setFrequency('daily')
    setOpen(false)
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button className="w-full flex items-center justify-center gap-2 py-3 bg-surface-2 border border-dashed border-border rounded-xl text-text-secondary hover:text-text hover:border-text-muted transition-colors text-sm font-medium">
          <Plus size={18} /> New Goal
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-bg/80 backdrop-blur-sm" />
        <Dialog.Content className="fixed bottom-0 left-0 right-0 z-50 bg-surface border-t border-border rounded-t-2xl p-5 shadow-2xl sm:inset-auto sm:left-1/2 sm:-translate-x-1/2 sm:top-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-md sm:rounded-2xl sm:border">
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-base font-medium text-text">Create Goal</Dialog.Title>
            <Dialog.Close className="text-text-muted hover:text-text"><X size={18} /></Dialog.Close>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs text-text-muted mb-1.5 uppercase tracking-wider">Goal Name</label>
              <input autoFocus required value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Drink Water"
                className="w-full bg-surface-2 border border-border rounded-xl px-4 py-3 text-text focus:border-accent focus:outline-none" />
            </div>

            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-xs text-text-muted mb-1.5 uppercase tracking-wider">Target</label>
                <input type="number" min="1" required value={target} onChange={e => setTarget(e.target.value)}
                  className="w-full bg-surface-2 border border-border rounded-xl px-4 py-3 text-text focus:border-accent focus:outline-none" />
              </div>
              <div className="flex-[2]">
                <label className="block text-xs text-text-muted mb-1.5 uppercase tracking-wider">Frequency</label>
                <select value={frequency} onChange={e => setFrequency(e.target.value)}
                  className="w-full bg-surface-2 border border-border rounded-xl px-4 py-3 text-text focus:border-accent focus:outline-none appearance-none capitalize">
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
            </div>

            <button type="submit" disabled={!name.trim() || addGoal.isPending}
              className="w-full bg-accent text-bg font-medium rounded-xl py-3 mt-2 hover:bg-accent-dim transition-colors disabled:opacity-50">
              {addGoal.isPending ? 'Saving...' : 'Create Goal'}
            </button>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
