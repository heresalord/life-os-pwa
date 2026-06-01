import { useState } from 'react'
import { format } from 'date-fns'
import { useSavingsGoals } from '../../../hooks/useFinanceQueries'
import { useFinanceMutations } from '../../../hooks/useFinanceMutations'
import type { SavingsGoal } from '../../../db/schema'
import { Plus, PiggyBank, Trash2, ArrowUpRight, ArrowDownLeft } from 'lucide-react'
import { EmptyState } from '../../../components/EmptyState'

const COLORS = ['#4ade80', '#60a5fa', '#f59e0b', '#a78bfa', '#f87171', '#34d399', '#fb923c', '#e879f9']

function FundsSheet({ goal, onClose }: { goal: SavingsGoal; onClose: () => void }) {
  const { updateSavingsGoal } = useFinanceMutations()
  const [mode, setMode] = useState<'add' | 'withdraw'>('add')
  const [amount, setAmount] = useState('')

  const handle = () => {
    const val = parseFloat(amount)
    if (!val || val <= 0) return
    const next = mode === 'add' ? goal.current + val : Math.max(0, goal.current - val)
    updateSavingsGoal.mutate({ id: goal.id, updates: { current: next } })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-bg/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full sm:max-w-sm bg-surface border border-border rounded-t-2xl sm:rounded-2xl p-5 shadow-2xl"
        style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}>
        <p className="font-medium text-text mb-1 truncate">{goal.name}</p>
        <p className="text-xs text-text-muted mb-4">{goal.current.toFixed(2)} / {goal.target.toFixed(2)} {goal.currency}</p>
        <div className="flex p-1 bg-surface-2 rounded-lg mb-4">
          <button onClick={() => setMode('add')} className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium rounded-md transition-colors ${mode === 'add' ? 'bg-surface text-success shadow-sm' : 'text-text-muted'}`}>
            <ArrowUpRight size={15} /> Add
          </button>
          <button onClick={() => setMode('withdraw')} className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium rounded-md transition-colors ${mode === 'withdraw' ? 'bg-surface text-warning shadow-sm' : 'text-text-muted'}`}>
            <ArrowDownLeft size={15} /> Withdraw
          </button>
        </div>
        <input autoFocus type="number" step="0.01" min="0" placeholder="0.00" value={amount}
          onChange={e => setAmount(e.target.value)} onKeyDown={e => e.key === 'Enter' && handle()}
          className="w-full bg-surface-2 border border-border rounded-xl px-4 py-3 text-text text-lg placeholder-text-muted focus:border-accent focus:outline-none mb-4" />
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 bg-surface-2 text-text font-medium rounded-xl hover:bg-muted transition-colors">Cancel</button>
          <button onClick={handle} disabled={!amount || updateSavingsGoal.isPending}
            className={`flex-[2] py-3 text-bg font-medium rounded-xl transition-colors disabled:opacity-50 ${mode === 'add' ? 'bg-success hover:bg-success/90' : 'bg-warning hover:bg-warning/90'}`}>
            {updateSavingsGoal.isPending ? 'Saving…' : mode === 'add' ? 'Add Funds' : 'Withdraw'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function SavingsTab({ currency }: { currency: string }) {
  const { data: goals = [] } = useSavingsGoals()
  const { addSavingsGoal, deleteSavingsGoal } = useFinanceMutations()
  const [isAdding, setIsAdding] = useState(false)
  const [activeGoal, setActiveGoal] = useState<SavingsGoal | null>(null)
  const [name, setName] = useState('')
  const [target, setTarget] = useState('')
  const [deadline, setDeadline] = useState('')
  const [color, setColor] = useState(COLORS[0])

  const handleAdd = () => {
    if (!name || !target) return
    addSavingsGoal.mutate({ name, target: Number(target), current: 0, currency, deadline: deadline || null, color })
    setIsAdding(false); setName(''); setTarget(''); setDeadline(''); setColor(COLORS[0])
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
          <input type="text" placeholder="Goal name (e.g. New laptop)" value={name} onChange={e => setName(e.target.value)}
            className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-text focus:border-accent outline-none" />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-text-muted mb-1 uppercase tracking-wider">Target ({currency})</label>
              <input type="number" placeholder="0.00" value={target} onChange={e => setTarget(e.target.value)}
                className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-text focus:border-accent outline-none" />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1 uppercase tracking-wider">Deadline</label>
              <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)}
                className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-text focus:border-accent outline-none" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-text-muted mb-2 uppercase tracking-wider">Color</label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map(c => (
                <button key={c} onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-full transition-transform ${color === c ? 'scale-125 ring-2 ring-offset-2 ring-offset-surface ring-white/50' : 'hover:scale-110'}`}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setIsAdding(false)} className="px-4 py-2 text-sm text-text-muted hover:text-text">Cancel</button>
            <button onClick={handleAdd} className="px-4 py-2 text-sm bg-success text-bg rounded-lg hover:bg-success/90 transition-colors">Save</button>
          </div>
        </div>
      )}

      {goals.length === 0 ? (
        <EmptyState icon={<PiggyBank size={40} />} title="No savings goals" message="Start saving for something special." />
      ) : (
        <div className="space-y-3">
          {goals.map((g: SavingsGoal) => {
            const pct = g.target > 0 ? Math.min((g.current / g.target) * 100, 100) : 0
            const met = g.current >= g.target
            return (
              <div key={g.id} className="bg-surface border border-border rounded-xl p-4 group relative">
                <button onClick={() => deleteSavingsGoal.mutate(g.id)}
                  className="absolute top-3 right-3 p-1.5 text-text-muted hover:text-danger opacity-0 group-hover:opacity-100 transition-all rounded-lg hover:bg-danger/10">
                  <Trash2 size={14} />
                </button>
                <div className="flex justify-between items-start mb-3 pr-8">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: g.color || '#4ade80' }} />
                    <div>
                      <h3 className="font-medium text-text flex items-center gap-2">
                        {g.name}
                        {met && <span className="text-[10px] bg-success/20 text-success px-2 py-0.5 rounded-full font-bold uppercase">Met ✓</span>}
                      </h3>
                      {g.deadline && <p className="text-xs text-text-muted">Due {format(new Date(g.deadline), 'MMM d, yyyy')}</p>}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-sm text-text">{g.current.toFixed(2)}</p>
                    <p className="text-xs text-text-muted">of {g.target.toFixed(2)} {g.currency}</p>
                  </div>
                </div>
                <div className="h-2.5 bg-surface-2 rounded-full overflow-hidden mb-3">
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: g.color || '#4ade80' }} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-text-muted">{Math.round(pct)}% saved</span>
                  <button onClick={() => setActiveGoal(g)}
                    className="flex items-center gap-1.5 text-xs bg-surface-2 hover:bg-border px-3 py-1.5 rounded-lg transition-colors text-text-secondary font-medium">
                    <ArrowUpRight size={13} /> Manage
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
      {activeGoal && <FundsSheet goal={activeGoal} onClose={() => setActiveGoal(null)} />}
    </div>
  )
}
