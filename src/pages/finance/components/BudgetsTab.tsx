import { useState, useMemo } from 'react'
import { startOfMonth, endOfMonth, startOfYear, endOfYear, format } from 'date-fns'
import { useBudgets } from '../../../hooks/useFinanceQueries'
import { useFinanceMutations } from '../../../hooks/useFinanceMutations'
import { useTransactionsRange } from '../../../hooks/useRangeQueries'
import { useAppStore } from '../../../store/useAppStore'
import { getUserLocalDate } from '../../../lib/dateUtils'
import type { Budget, Transaction } from '../../../db/schema'
import { Plus, Target, Trash2, Pencil, X } from 'lucide-react'
import { EmptyState } from '../../../components/EmptyState'
import { useUserSettings } from '../../../hooks/useUserSettings'
import { haptic } from '../../../lib/haptic'
import { SheetSelect } from '../../../components/SheetSelect'
import clsx from 'clsx'

const DEFAULT_EXPENSE_CATS = ['food', 'transport', 'housing', 'utilities', 'entertainment', 'shopping', 'health', 'other']

const PERIOD_OPTIONS = [
  { value: 'daily',   label: 'Daily'   },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly',  label: 'Yearly'  },
]

function Sheet({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center animate-in fade-in duration-200">
      <div className="absolute inset-0 bg-bg/80 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative z-10 w-full sm:max-w-md bg-surface border border-border rounded-t-3xl sm:rounded-2xl p-5 shadow-2xl max-h-[90dvh] overflow-y-auto animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200"
        style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
      >
        <div className="w-10 h-1 rounded-full bg-border mx-auto mb-4 sm:hidden" />
        {children}
      </div>
    </div>
  )
}

export function BudgetsTab({ currency }: { currency: string }) {
  const { data: budgets = [] } = useBudgets()
  const { addBudget, deleteBudget, updateBudget } = useFinanceMutations()
  const { data: settings } = useUserSettings()
  const expCats = settings?.expense_categories?.length ? settings.expense_categories : DEFAULT_EXPENSE_CATS
  const { timezone } = useAppStore()

  const today = getUserLocalDate(timezone)
  const todayDate = new Date(today + 'T12:00:00')

  const yearFrom = format(startOfYear(todayDate), 'yyyy-MM-dd')
  const { data: allTxns = [] } = useTransactionsRange(yearFrom, today)

  // ── Modal sheet state ──
  const [isAdding, setIsAdding]         = useState(false)
  const [newCategory, setNewCategory]   = useState(expCats[0])
  const [newAmount, setNewAmount]       = useState('')
  const [newPeriod, setNewPeriod]       = useState<Budget['period']>('monthly')
  const [addError, setAddError]         = useState<string | null>(null)

  // ── Edit state ──
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null)
  const [editCategory, setEditCategory]   = useState('')
  const [editAmount, setEditAmount]       = useState('')
  const [editPeriod, setEditPeriod]       = useState<Budget['period']>('monthly')
  const [editError, setEditError]         = useState<string | null>(null)

  const openAdd = () => {
    haptic('light')
    setNewCategory(expCats[0])
    setNewAmount('')
    setNewPeriod('monthly')
    setAddError(null)
    setIsAdding(true)
  }

  const openEdit = (b: Budget) => {
    haptic('light')
    setEditError(null)
    setEditingBudget(b)
    setEditCategory(b.category)
    setEditAmount(String(b.limit_amount))
    setEditPeriod(b.period)
  }

  const closeEdit = () => {
    setEditingBudget(null)
    setEditError(null)
  }

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingBudget || !editAmount) return
    const isDuplicate = budgets.some(
      b => b.id !== editingBudget.id && b.category.toLowerCase() === editCategory.toLowerCase() && b.period === editPeriod
    )
    if (isDuplicate) {
      setEditError(`A ${editPeriod} budget for "${editCategory}" already exists.`)
      return
    }
    setEditError(null)
    haptic('success')
    updateBudget.mutate({
      id: editingBudget.id,
      updates: { category: editCategory, period: editPeriod, limit_amount: Number(editAmount) },
    })
    closeEdit()
  }

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newCategory || !newAmount) return
    const isDuplicate = budgets.some(
      b => b.category.toLowerCase() === newCategory.toLowerCase() && b.period === newPeriod
    )
    if (isDuplicate) {
      setAddError(`A ${newPeriod} budget for "${newCategory}" already exists.`)
      return
    }
    setAddError(null)
    haptic('success')
    addBudget.mutate({ category: newCategory, period: newPeriod, limit_amount: Number(newAmount), currency })
    setIsAdding(false)
    setNewAmount('')
  }

  const getRangeForPeriod = (period: Budget['period']) => {
    if (period === 'daily')   return { from: today, to: today }
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

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-base font-bold text-text">Budgets</h2>
          <p className="text-xs text-text-secondary mt-0.5">Track your spending limits by category</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-1.5 text-xs font-semibold bg-accent/10 border border-accent/20 text-accent px-3 py-2 rounded-xl hover:bg-accent/20 transition-all active:scale-95 shadow-xs cursor-pointer"
        >
          <Plus size={15} /> New Budget
        </button>
      </div>

      {budgets.length === 0 ? (
        <EmptyState icon={<Target size={40} />} title="No budgets set" message="Create a budget to track spending limits per category." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {budgets.map((b: Budget) => {
            const spent = spentByBudget[b.id] ?? 0
            const pct   = Math.min((spent / b.limit_amount) * 100, 100)
            const over  = spent > b.limit_amount

            return (
              <div
                key={b.id}
                className={clsx(
                  'bg-surface border rounded-2xl p-4 group relative shadow-xs transition-all',
                  over ? 'border-danger/30 bg-danger/[0.02]' : 'border-border/80 hover:border-border'
                )}
              >
                {/* Action buttons */}
                <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => openEdit(b)}
                    className="p-1.5 text-text-muted hover:text-text rounded-lg hover:bg-surface-2 transition-colors active:scale-90"
                    aria-label="Edit budget"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={() => {
                      haptic('medium')
                      deleteBudget.mutate(b.id)
                    }}
                    className="p-1.5 text-text-muted hover:text-danger rounded-lg hover:bg-danger/10 transition-colors active:scale-90"
                    aria-label="Delete budget"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>

                <div className="flex justify-between items-start mb-3 pr-14">
                  <div>
                    <h3 className="font-semibold text-text capitalize text-sm">{b.category}</h3>
                    <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-surface-2 text-text-muted text-[10px] font-bold uppercase tracking-wider">
                      {b.period}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className={clsx('font-bold text-sm tabular-nums', over ? 'text-danger' : 'text-text')}>
                      {spent.toFixed(2)} <span className="text-text-muted font-normal text-xs">/ {b.limit_amount.toFixed(2)}</span>
                    </p>
                    <p className="text-[11px] text-text-muted mt-0.5">{b.currency}</p>
                  </div>
                </div>

                {/* iOS rounded progress track */}
                <div className="h-2.5 bg-surface-2 rounded-full overflow-hidden p-0.5 mb-2">
                  <div
                    className={clsx(
                      'h-full rounded-full transition-all duration-500',
                      pct >= 95 ? 'bg-danger' : pct >= 75 ? 'bg-amber-400' : 'bg-success'
                    )}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="flex justify-between text-[11px] text-text-muted font-medium">
                  <span>{Math.round(pct)}% used</span>
                  <span className={clsx(over && 'text-danger font-semibold')}>
                    {over
                      ? `${(spent - b.limit_amount).toFixed(2)} over`
                      : `${(b.limit_amount - spent).toFixed(2)} remaining`
                    }
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Add Budget Bottom Sheet ── */}
      <Sheet open={isAdding} onClose={() => { setIsAdding(false); setAddError(null) }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-text">New Budget</h3>
          <button
            onClick={() => { haptic('light'); setIsAdding(false) }}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-surface-2 text-text-muted hover:text-text transition-colors active:scale-90"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleAddSubmit} className="space-y-4">
          <div>
            <label className="block text-[11px] font-bold text-text-muted mb-1.5 uppercase tracking-wider">Category</label>
            <SheetSelect
              label="Category"
              value={newCategory}
              onChange={setNewCategory}
              capitalize
              options={expCats.map(c => ({ value: c, label: c }))}
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-text-muted mb-1.5 uppercase tracking-wider">Limit ({currency})</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              required
              placeholder="0.00"
              value={newAmount}
              onChange={e => setNewAmount(e.target.value)}
              className="w-full bg-surface-2 border border-border rounded-xl px-4 py-2.5 text-sm text-text focus:border-accent focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-text-muted mb-1.5 uppercase tracking-wider">Period</label>
            <SheetSelect
              label="Period"
              value={newPeriod}
              onChange={v => setNewPeriod(v as Budget['period'])}
              options={PERIOD_OPTIONS}
            />
          </div>

          {addError && <p className="text-xs text-danger font-medium">{addError}</p>}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={() => { haptic('light'); setIsAdding(false) }}
              className="flex-1 py-3 text-xs font-semibold text-text-secondary hover:text-text bg-surface-2 rounded-xl transition-colors active:scale-95 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!newAmount || addBudget.isPending}
              className="flex-1 py-3 text-xs font-semibold bg-accent text-bg rounded-xl hover:bg-accent-dim transition-all active:scale-95 shadow-xs disabled:opacity-50 cursor-pointer"
            >
              {addBudget.isPending ? 'Saving…' : 'Create Budget'}
            </button>
          </div>
        </form>
      </Sheet>

      {/* ── Edit Budget Bottom Sheet ── */}
      <Sheet open={!!editingBudget} onClose={closeEdit}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-text">Edit Budget</h3>
          <button
            onClick={() => { haptic('light'); closeEdit() }}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-surface-2 text-text-muted hover:text-text transition-colors active:scale-90"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSaveEdit} className="space-y-4">
          <div>
            <label className="block text-[11px] font-bold text-text-muted mb-1.5 uppercase tracking-wider">Category</label>
            <SheetSelect
              label="Category"
              value={editCategory}
              onChange={setEditCategory}
              capitalize
              options={expCats.map(c => ({ value: c, label: c }))}
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-text-muted mb-1.5 uppercase tracking-wider">Limit ({currency})</label>
            <input
              autoFocus
              type="number"
              step="0.01"
              min="0.01"
              required
              placeholder="0.00"
              value={editAmount}
              onChange={e => setEditAmount(e.target.value)}
              className="w-full bg-surface-2 border border-border rounded-xl px-4 py-2.5 text-sm text-text focus:border-accent focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-text-muted mb-1.5 uppercase tracking-wider">Period</label>
            <SheetSelect
              label="Period"
              value={editPeriod}
              onChange={v => setEditPeriod(v as Budget['period'])}
              options={PERIOD_OPTIONS}
            />
          </div>

          {editError && <p className="text-xs text-danger font-medium">{editError}</p>}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={() => { haptic('light'); closeEdit() }}
              className="flex-1 py-3 text-xs font-semibold text-text-secondary hover:text-text bg-surface-2 rounded-xl transition-colors active:scale-95 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!editAmount || updateBudget.isPending}
              className="flex-1 py-3 text-xs font-semibold bg-accent text-bg rounded-xl hover:bg-accent-dim transition-all active:scale-95 shadow-xs disabled:opacity-50 cursor-pointer"
            >
              {updateBudget.isPending ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Sheet>
    </div>
  )
}
