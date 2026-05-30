import { useState } from 'react'
import { useBudgets } from '../../../hooks/useFinanceQueries'
import type { Budget } from '../../../db/schema'
import { useFinanceMutations } from '../../../hooks/useFinanceMutations'
import { Plus, Target } from 'lucide-react'
import { EmptyState } from '../../../components/EmptyState'

export function BudgetsTab({ currency }: { currency: string }) {
  const budgets = useBudgets() || []
  const { addBudget } = useFinanceMutations()
  const [isAdding, setIsAdding] = useState(false)
  const [newCategory, setNewCategory] = useState('')
  const [newAmount, setNewAmount] = useState('')
  const [newPeriod, setNewPeriod] = useState<'daily' | 'monthly' | 'yearly'>('monthly')

  const handleAdd = () => {
    if (!newCategory || !newAmount) return
    addBudget.mutate({
      user_id: 'temp', // This should be handled properly with auth context if needed, but dexie saves it. Actually Dexie schema has user_id but we just set it.
      category: newCategory,
      period: newPeriod,
      limit_amount: Number(newAmount),
      currency: currency
    })
    setIsAdding(false)
    setNewCategory('')
    setNewAmount('')
  }

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-medium text-text">Budgets</h2>
        <button onClick={() => setIsAdding(true)} className="flex items-center gap-1.5 text-sm bg-accent/10 text-accent px-3 py-1.5 rounded-lg hover:bg-accent/20 transition-colors">
          <Plus size={16} /> New Budget
        </button>
      </div>

      {isAdding && (
        <div className="bg-surface p-4 rounded-xl border border-border space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input type="text" placeholder="Category (e.g. Food)" value={newCategory} onChange={e => setNewCategory(e.target.value)} className="bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm" />
            <input type="number" placeholder="Limit Amount" value={newAmount} onChange={e => setNewAmount(e.target.value)} className="bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm" />
          </div>
          <select value={newPeriod} onChange={e => setNewPeriod(e.target.value as any)} className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm">
            <option value="daily">Daily</option>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
          </select>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setIsAdding(false)} className="px-4 py-2 text-sm text-text-muted hover:text-text">Cancel</button>
            <button onClick={handleAdd} className="px-4 py-2 text-sm bg-accent text-white rounded-lg">Save</button>
          </div>
        </div>
      )}

      {budgets.length === 0 ? (
        <EmptyState icon={<Target size={40} />} title="No budgets set" message="Create a budget to track spending limits." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {budgets.map((b: Budget) => {
            // Placeholder for actual spent logic. We'd ideally pass down transactions and calculate.
            const spent = 0; 
            const pct = Math.min((spent / b.limit_amount) * 100, 100)
            const over = spent > b.limit_amount

            return (
              <div key={b.id} className="bg-surface border border-border rounded-xl p-4">
                <div className="flex justify-between items-center mb-2">
                  <div>
                    <h3 className="font-medium text-text capitalize">{b.category}</h3>
                    <p className="text-xs text-text-muted capitalize">{b.period}</p>
                  </div>
                  <div className="text-right">
                    <p className={`font-medium ${over ? 'text-warning' : 'text-text'}`}>{spent.toFixed(2)} / {b.limit_amount.toFixed(2)}</p>
                    <p className="text-xs text-text-muted">{b.currency}</p>
                  </div>
                </div>
                <div className="h-2 bg-surface-2 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${over ? 'bg-warning' : 'bg-accent'}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
