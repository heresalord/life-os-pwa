import React, { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Plus, X } from 'lucide-react'
import { useGoalMutations } from '../../hooks/useGoalMutations'

type GoalType        = 'year' | 'general' | 'binary'
type MeasurementType = 'count' | 'currency' | 'time' | 'percentage' | 'binary'

const GOAL_TYPES: { value: GoalType; label: string }[] = [
  { value: 'year',    label: 'Year goal' },
  { value: 'general', label: 'General'   },
  { value: 'binary',  label: 'Yes / No'  },
]

const MEASUREMENT_TYPES: { value: MeasurementType; label: string }[] = [
  { value: 'count',      label: 'Count'      },
  { value: 'currency',   label: 'Currency'   },
  { value: 'time',       label: 'Hours'      },
  { value: 'percentage', label: 'Percentage' },
  { value: 'binary',     label: 'Binary'     },
]

export function AddGoalModal() {
  const [open, setOpen]                   = useState(false)
  const [name, setName]                   = useState('')
  const [target, setTarget]               = useState('1')
  const [goalType, setGoalType]           = useState<GoalType>('general')
  const [measurementType, setMeasurementType] = useState<MeasurementType>('count')
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
        <Dialog.Content
          className="fixed bottom-0 left-0 right-0 z-50 bg-surface border-t border-border rounded-t-2xl p-5 shadow-2xl sm:inset-auto sm:left-1/2 sm:-translate-x-1/2 sm:top-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-md sm:rounded-2xl sm:border"
          style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
        >
          <div className="w-10 h-1 rounded-full bg-border mx-auto mb-4 sm:hidden" />
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-base font-medium text-text">Create Goal</Dialog.Title>
            <Dialog.Close className="text-text-muted hover:text-text"><X size={18} /></Dialog.Close>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs text-text-muted mb-1.5 uppercase tracking-wider">Goal Name</label>
              <input autoFocus type="text" placeholder="What do you want to achieve?"
                value={name} onChange={e => setName(e.target.value)}
                className="w-full bg-surface-2 border border-border rounded-xl px-4 py-3 text-text placeholder-text-muted focus:border-accent focus:outline-none" />
            </div>

            <div>
              <label className="block text-xs text-text-muted mb-1.5 uppercase tracking-wider">Target</label>
              <input type="number" min="1" placeholder="Target value"
                value={target} onChange={e => setTarget(e.target.value)}
                className="w-full bg-surface-2 border border-border rounded-xl px-4 py-3 text-text focus:border-accent focus:outline-none" />
            </div>

            <div>
              <label className="block text-xs text-text-muted mb-1.5 uppercase tracking-wider">Type</label>
              <div className="grid grid-cols-3 gap-2">
                {GOAL_TYPES.map(t => (
                  <button key={t.value} type="button" onClick={() => setGoalType(t.value)}
                    className={`py-2 rounded-xl text-sm font-medium border transition-all ${
                      goalType === t.value ? 'bg-accent/10 border-accent text-accent' : 'border-border text-text-muted hover:text-text'
                    }`}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs text-text-muted mb-1.5 uppercase tracking-wider">Measure by</label>
              <div className="grid grid-cols-3 gap-2">
                {MEASUREMENT_TYPES.map(m => (
                  <button key={m.value} type="button" onClick={() => setMeasurementType(m.value)}
                    className={`py-2 rounded-xl text-sm font-medium border transition-all ${
                      measurementType === m.value ? 'bg-accent/10 border-accent text-accent' : 'border-border text-text-muted hover:text-text'
                    }`}>
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            <button type="submit" disabled={!name.trim() || addGoal.isPending}
              className="w-full bg-accent text-bg font-medium rounded-xl py-3 hover:bg-accent-dim transition-colors disabled:opacity-50">
              {addGoal.isPending ? 'Creating…' : 'Create Goal'}
            </button>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
