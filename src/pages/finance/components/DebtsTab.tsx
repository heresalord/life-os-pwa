import { useState } from 'react'
import { format } from 'date-fns'
import { useDebts } from '../../../hooks/useFinanceQueries'
import { useFinanceMutations } from '../../../hooks/useFinanceMutations'
import type { Debt } from '../../../db/schema'
import { Plus, CreditCard, CheckCircle2, Trash2 } from 'lucide-react'
import { EmptyState } from '../../../components/EmptyState'

export function DebtsTab({ currency }: { currency: string }) {
  const { data: debts = [] } = useDebts()
  const { addDebt, deleteDebt, toggleDebtPaid } = useFinanceMutations()
  const [isAdding, setIsAdding] = useState(false)
  const [name, setName]       = useState('')
  const [amount, setAmount]   = useState('')
  const [type, setType]       = useState<'i_owe' | 'owe_me'>('i_owe')
  const [dueDate, setDueDate] = useState('')

  const handleAdd = () => {
    if (!name || !amount) return
    addDebt.mutate({ name, amount: Number(amount), type, due_date: dueDate || null, paid: false })
    setIsAdding(false); setName(''); setAmount(''); setDueDate('')
  }

  const iOwe  = debts.filter((d: Debt) => d.type === 'i_owe')
  const oweMe = debts.filter((d: Debt) => d.type === 'owe_me')

  const DebtCard = ({ d }: { d: Debt }) => (
    <div className={`flex items-start justify-between p-3 rounded-xl border group transition-opacity ${d.paid ? 'bg-surface-2/50 border-transparent opacity-60' : 'bg-surface border-border'}`}>
      <div className="flex-1 min-w-0 mr-3">
        <p className={`font-medium text-sm ${d.paid ? 'line-through text-text-muted' : 'text-text'}`}>{d.name}</p>
        {d.due_date && <p className="text-[10px] text-text-muted mt-0.5">Due {format(new Date(d.due_date), 'MMM d, yyyy')}</p>}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className={`font-semibold text-sm ${d.type === 'i_owe' ? 'text-warning' : 'text-success'}`}>
          {Number(d.amount).toFixed(2)}
        </span>
        <button onClick={() => toggleDebtPaid.mutate({ id: d.id, paid: !d.paid })}
          className={`p-1.5 rounded-full transition-colors ${d.paid ? 'text-success bg-success/10' : 'text-text-muted hover:text-text bg-surface-2'}`}>
          <CheckCircle2 size={18} />
        </button>
        <button onClick={() => deleteDebt.mutate(d.id)}
          className="p-1.5 text-text-muted hover:text-danger hover:bg-danger/10 rounded-full transition-colors opacity-0 group-hover:opacity-100">
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  )

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-medium text-text">Debts & Loans</h2>
        <button onClick={() => setIsAdding(true)}
          className="flex items-center gap-1.5 text-sm bg-accent/10 text-accent px-3 py-1.5 rounded-lg hover:bg-accent/20 transition-colors">
          <Plus size={16} /> Add Debt
        </button>
      </div>

      {isAdding && (
        <div className="bg-surface p-4 rounded-xl border border-border space-y-3">
          <div className="flex p-1 bg-surface-2 rounded-lg">
            <button type="button" onClick={() => setType('i_owe')} className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${type === 'i_owe' ? 'bg-surface text-text shadow-sm' : 'text-text-muted'}`}>I Owe</button>
            <button type="button" onClick={() => setType('owe_me')} className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${type === 'owe_me' ? 'bg-surface text-text shadow-sm' : 'text-text-muted'}`}>Owed to Me</button>
          </div>
          <input type="text" placeholder="Person or entity" value={name} onChange={e => setName(e.target.value)}
            className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-text focus:border-accent outline-none" />
          <div className="grid grid-cols-2 gap-3">
            <input type="number" placeholder="Amount" value={amount} onChange={e => setAmount(e.target.value)}
              className="bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-text focus:border-accent outline-none" />
            <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
              className="bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-text focus:border-accent outline-none" />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setIsAdding(false)} className="px-4 py-2 text-sm text-text-muted hover:text-text">Cancel</button>
            <button onClick={handleAdd} className="px-4 py-2 text-sm bg-accent text-bg rounded-lg hover:bg-accent-dim transition-colors">Save</button>
          </div>
        </div>
      )}

      {debts.length === 0 ? (
        <EmptyState icon={<CreditCard size={40} />} title="No debts" message="Keep track of money you owe or are owed." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <div className="flex justify-between items-center border-b border-border pb-2">
              <h3 className="text-sm font-semibold text-warning">I Owe</h3>
              <span className="text-sm font-medium text-warning">
                {iOwe.filter((d: Debt) => !d.paid).reduce((s: number, d: Debt) => s + Number(d.amount), 0).toFixed(2)} {currency}
              </span>
            </div>
            {iOwe.length === 0
              ? <p className="text-xs text-text-muted text-center py-4">Nothing owed 🎉</p>
              : iOwe.map((d: Debt) => <DebtCard key={d.id} d={d} />)
            }
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center border-b border-border pb-2">
              <h3 className="text-sm font-semibold text-success">Owed to Me</h3>
              <span className="text-sm font-medium text-success">
                {oweMe.filter((d: Debt) => !d.paid).reduce((s: number, d: Debt) => s + Number(d.amount), 0).toFixed(2)} {currency}
              </span>
            </div>
            {oweMe.length === 0
              ? <p className="text-xs text-text-muted text-center py-4">No one owes you anything</p>
              : oweMe.map((d: Debt) => <DebtCard key={d.id} d={d} />)
            }
          </div>
        </div>
      )}
    </div>
  )
}
