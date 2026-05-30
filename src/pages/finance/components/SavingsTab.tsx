import { useState } from 'react'
import { useSavingsGoals } from '../../../hooks/useFinanceQueries'
import type { SavingsGoal } from '../../../db/schema'
import { useFinanceMutations } from '../../../hooks/useFinanceMutations'
import { Plus, PiggyBank, Edit2 } from 'lucide-react'
import { EmptyState } from '../../../components/EmptyState'
import { format } from 'date-fns'

export function SavingsTab({ currency }: { currency: string }) {
  const goals = useSavingsGoals() || []
  const { addSavingsGoal, updateSavingsGoal } = useFinanceMutations()
  const [isAdding, setIsAdding] = useState(false)
  
  const [name, setName] = useState('')
  const [target, setTarget] = useState('')
  const [deadline, setDeadline] = useState('')

  const handleAdd = () => {
    if (!name || !target) return
    addSavingsGoal.mutate({
      user_id: 'temp',
      name,
      target: Number(target),
      current: 0,
      currency,
      deadline: deadline || null,
      color: '#4ade80'
    })
    setIsAdding(false)
    setName('')
    setTarget('')
    setDeadline('')
  }

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-medium text-text">Savings Goals</h2>
        <button onClick={() => setIsAdding(true)} className="flex items-center gap-1.5 text-sm bg-success/10 text-success px-3 py-1.5 rounded-lg hover:bg-success/20 transition-colors">
          <Plus size={16} /> New Goal
        </button>
      </div>

      {isAdding && (
        <div className="bg-surface p-4 rounded-xl border border-border space-y-3">
          <input type="text" placeholder="Goal Name (e.g. New Car)" value={name} onChange={e => setName(e.target.value)} className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm" />
          <div className="grid grid-cols-2 gap-3">
            <input type="number" placeholder="Target Amount" value={target} onChange={e => setTarget(e.target.value)} className="bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm" />
            <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} className="bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-text-muted" />
          </div>
          <div className="flex gap-2 justify-end mt-2">
            <button onClick={() => setIsAdding(false)} className="px-4 py-2 text-sm text-text-muted hover:text-text">Cancel</button>
            <button onClick={handleAdd} className="px-4 py-2 text-sm bg-success text-white rounded-lg">Save</button>
          </div>
        </div>
      )}

      {goals.length === 0 ? (
        <EmptyState icon={<PiggyBank size={40} />} title="No savings goals" message="Start saving for something special." />
      ) : (
        <div className="space-y-3">
          {goals.map((g: SavingsGoal) => {
            const pct = Math.min((g.current / g.target) * 100, 100)
            return (
              <div key={g.id} className="bg-surface border border-border rounded-xl p-4">
                <div className="flex justify-between items-center mb-2">
                  <div>
                    <h3 className="font-medium text-text flex items-center gap-2">
                      {g.name}
                      {g.current >= g.target && <span className="text-[10px] bg-success/20 text-success px-2 py-0.5 rounded-full uppercase font-bold tracking-wider">Met</span>}
                    </h3>
                    {g.deadline && <p className="text-xs text-text-muted mt-0.5">Target: {format(new Date(g.deadline), 'MMM d, yyyy')}</p>}
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-success">{g.current.toFixed(2)} / {g.target.toFixed(2)}</p>
                    <p className="text-xs text-text-muted">{g.currency}</p>
                  </div>
                </div>
                <div className="h-2.5 bg-surface-2 rounded-full overflow-hidden mb-3">
                  <div className="h-full bg-success rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                </div>
                <div className="flex justify-end">
                  <button 
                    onClick={() => {
                      const amount = prompt('Add funds amount:')
                      if (amount && !isNaN(Number(amount))) {
                        updateSavingsGoal.mutate({ id: g.id, current: g.current + Number(amount) })
                      }
                    }}
                    className="flex items-center gap-1.5 text-xs bg-surface-2 hover:bg-border px-3 py-1.5 rounded-lg transition-colors text-text-secondary"
                  >
                    <Edit2 size={12} /> Add Funds
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
