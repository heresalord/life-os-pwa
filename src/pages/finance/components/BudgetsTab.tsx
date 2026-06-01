import { useState, useMemo } from 'react'
import { startOfMonth, endOfMonth, startOfYear, endOfYear, format } from 'date-fns'
import { useBudgets } from '../../../hooks/useFinanceQueries'
import { useFinanceMutations } from '../../../hooks/useFinanceMutations'
import { useTransactionsRange } from '../../../hooks/useRangeQueries'
import { useAppStore } from '../../../store/useAppStore'
import { getUserLocalDate } from '../../../lib/dateUtils'
import type { Budget, Transaction } from '../../../db/schema'
import { Plus, Target, Trash2 } from 'lucide-react'
import { EmptyState } from '../../../components/EmptyState'
import { useUserSettings } from '../../../hooks/useUserSettings'

const DEFAULT_EXPENSE_CATS = ['food', 'transport', 'housing', 'utilities', 'entertainment', 'shopping', 'health', 'other']

export function BudgetsTab({ currency }: { currency: string }) {
  const { data: budgets = [] } = useBudgets()
  const { addBudget, deleteBudget } = useFinanceMutations()
  const { data: settings } = useUserSettings()
  const expCats = settings?.expense_categories?.length ? settings.expense_categories : DEFAULT_EXPENSE_CATS
  const { timezone } = useAppStore()

  const today = getUserLocalDate(timezone)
  const todayDate = new Date(today + 'T12:00:00')

  const yearFrom = format(startOfYear(todayDate), 'yyyy-MM-dd')
  const { data: allTxns = [] } = useTransactionsRange(yearFrom, today)

  const [isAdding, setIsAdding] = useState(false)
  const [newCategory, setNewCategory] = useState(expCats[0])
  const [newAmount, setNewAmount] = useState('')
  const [newPeriod, setNewPeriod] = useState<'daily' | 'monthly' | 'yearly'>('monthly')

  const getRangeForPeriod = (period: Budget['period']) => {
    if (period === 'daily') return { from: today, to: today }
    if (period === 'monthly') return { from: format(startOfMonth(todayDate), 'yyyy-MM-dd'), to: format(endOfMonth(todayDate), 'yyyy-MM-dd') }
    return { from: format(startOfYear(todayDate), 'yyyy-MM-dd'), to: format(endOfYear(todayDate), 'yyyy-MM-dd') }
  }

  const spentByBudget = useMemo(() => {
    const result: Record<string, number> = {}
    for (const b of budgets) {
      const { from, to } = getRangeForPeriod(b.period)
      result[b.id] = (allTxns as Transaction[])
        .filter(t => t.type === 'expense' && t.category === b.category && t.date >= from && t.date <= to)
        .reduce((s, t) => s + Number(t.amount), 0)
    }
    return result
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [budgets, allTxns, today])

  const handleAdd = () => {
    if (!newCategory || !newAmount) return
    addBudget.mutate({ category: newCategory, period: newPeriod, limit_amount: Number(newAmount), currency })
    setIsAdding(false)
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
            <div>
              <label className="block text-xs text-text-muted mb-1 uppercase tracking-wider">Category</label>
              <select value={newCategory} onChange={e => setNewCategory(e.target.value)}
                className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-text capitalize focus:border-accent outline-none appearance-none">
                {expCats.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1 uppercase tracking-wider">Limit ({currency})</label>
              <input type="number" placeholder="0.00" value={newAmount} onChange={e => setNewAmount(e.target.value)}
                className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-text focus:border-accent outline-none" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-text-muted mb-1 uppercase tracking-wider">Period</label>
            <select value={newPeriod} onChange={e => setNewPeriod(e.target.value as Budget['period'])}
              className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-text focus:border-accent outline-none appearance-none">
              <option value="daily">Daily</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setIsAdding(false)} className="px-4 py-2 text-sm text-text-muted hover:text-text">Cancel</button>
            <button onClick={handleAdd} className="px-4 py-2 text-sm bg-accent text-bg rounded-lg hover:bg-accent-dim transition-colors">Save</button>
          </div>
        </div>
      )}

      {budgets.length === 0 ? (
        <EmptyState icon={<Target size={40} />} title="No budgets set" message="Create a budget to track spending limits per category." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {budgets.map((b: Budget) => {
            const spent = spentByBudget[b.id] ?? 0
            const pct   = Math.min((spent / b.limit_amount) * 100, 100)
            const over  = spent > b.limit_amount
            return (
              <div key={b.id} className="bg-surface border border-border rounded-xl p-4 group relative">
                <button onClick={() => deleteBudget.mutate(b.id)}
                  className="absolute top-3 right-3 p-1.5 text-text-muted hover:text-danger opacity-0 group-hover:opacity-100 transition-all rounded-lg hover:bg-danger/10">
                  <Trash2 size={14} />
                </button>
                <div className="flex justify-between items-start mb-3 pr-6">
                  <div><h3 className="font-medium text-text capitalize">{b.category}</h3><p className="text-xs text-text-muted capitalize">{b.period}</p></div>
                  <div className="text-right"><p className={`font-semibold text-sm ${over ? 'text-danger' : 'text-text'}`}>{spent.toFixed(2)} / {b.limit_amount.toFixed(2)}</p><p className="text-xs text-text-muted">{b.currency}</p></div>
                </div>
                <div className="h-2 bg-surface-2 rounded-full overflow-hidden mb-2">
                  <div className={`h-full rounded-full transition-all duration-500 ${over ? 'bg-danger' : pct > 80 ? 'bg-warning' : 'bg-accent'}`} style={{ width: `${pct}%` }} />
                </div>
                <div className="flex justify-between text-xs text-text-muted">
                  <span>{Math.round(pct)}% used</span>
                  <span className={over ? 'text-danger font-medium' : ''}>
                    {over ? `${(spent - b.limit_amount).toFixed(2)} over` : `${(b.limit_amount - spent).toFixed(2)} remaining`}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
