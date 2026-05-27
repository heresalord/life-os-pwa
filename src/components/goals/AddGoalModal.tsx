import React, { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Plus, X } from 'lucide-react'
import { useGoalMutations } from '../../hooks/useGoalMutations'

const GOAL_TYPES = [
  { value: 'year',    label: 'Year goal'   },
  { value: 'general', label: 'General'     },
  { value: 'binary',  label: 'Yes / No'   },
]

const MEASUREMENT_TYPES = [
  { value: 'count',      label: 'Count'      },
  { value: 'currency',   label: 'Currency'   },
  { value: 'time',       label: 'Hours'      },
  { value: 'percentage', label: 'Percentage' },
  { value: 'binary',     label: 'Binary'     },
]

export function AddGoalModal() {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [target, setTarget] = useState('1')
  const [goalType, setGoalType] = useState('general')
  const [measurementType, setMeasurementType] = useState('count')
  const { addGoal } = useGoalMutations()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !target) return
    addGoal.mutate({
      name: name.trim(),
      target: parseInt(target),
      goal_type: goalType,
      measurement_type: measurementType,
    })
    setName('')
    setTarget('1')
    setGoalType('general')
    setMeasurementType('count')
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
        <Dialog.Content className="fixed bottom-0 left-0 right-0 z-50 bg-surface border-t border-border rounded-t-2xl p-5 shadow-2xl sm:inset-auto sm:left-1/2 sm:-translate-x-1/2 sm:top-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-md sm:rounded-2xl sm:border"
          style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}>
          <div className="w-10 h-1 rounded-full bg-border mx-auto mb-4 sm:hidden" />
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-base font-medium text-text">Create Goal</Dialog.Title>
            <Dialog.Close className="text-text-muted hover:text-text"><X size={18} /></Dialog.Close>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs text-text-muted mb-1.5 uppercase tracking-wider">Goal Name</label>
              <input autoFocus required value={name} onChange={e => setName(e.target.value)}
                placeholder="e.g. Read 24 books, Save 5000, Run 100km"
                className="selectable w-full bg-surface-2 border border-border rounded-xl px-4 py-3 text-text focus:border-accent focus:outline-none" />
            </div>

            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-xs text-text-muted mb-1.5 uppercase tracking-wider">Target</label>
                <input type="number" min="1" required value={target} onChange={e => setTarget(e.target.value)}
                  className="selectable w-full bg-surface-2 border border-border rounded-xl px-4 py-3 text-text focus:border-accent focus:outline-none" />
              </div>
              <div className="flex-[2]">
                <label className="block text-xs text-text-muted mb-1.5 uppercase tracking-wider">Measure</label>
                <select value={measurementType} onChange={e => setMeasurementType(e.target.value)}
                  className="w-full bg-surface-2 border border-border rounded-xl px-4 py-3 text-text focus:border-accent focus:outline-none appearance-none">
                  {MEASUREMENT_TYPES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs text-text-muted mb-1.5 uppercase tracking-wider">Type</label>
              <div className="flex gap-2">
                {GOAL_TYPES.map(t => (
                  <button key={t.value} type="button" onClick={() => setGoalType(t.value)}
                    className={`flex-1 py-2 text-xs font-medium rounded-lg border transition-colors ${
                      goalType === t.value
                        ? 'bg-accent/15 border-accent/40 text-accent'
                        : 'bg-surface-2 border-border text-text-muted hover:text-text'
                    }`}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <button type="submit" disabled={!name.trim() || addGoal.isPending}
              className="w-full bg-accent text-bg font-medium rounded-xl py-3 hover:bg-accent-dim transition-colors disabled:opacity-50">
              {addGoal.isPending ? 'Saving…' : 'Create Goal'}
            </button>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
