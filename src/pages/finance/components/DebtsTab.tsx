import { useState } from 'react'
import { useDebts } from '../../../hooks/useFinanceQueries'
import type { Debt } from '../../../db/schema'
import { useFinanceMutations } from '../../../hooks/useFinanceMutations'
import { Plus, CreditCard, CheckCircle2 } from 'lucide-react'
import { EmptyState } from '../../../components/EmptyState'
import { format } from 'date-fns'

export function DebtsTab({ currency }: { currency: string }) {
  const debts = useDebts() || []
  const { addDebt, toggleDebtPaid } = useFinanceMutations()
  const [isAdding, setIsAdding] = useState(false)
  
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [type, setType] = useState<'i_owe' | 'owe_me'>('i_owe')
  const [dueDate, setDueDate] = useState('')

  const handleAdd = () => {
    if (!name || !amount) return
    addDebt.mutate({
      user_id: 'temp',
      name,
      amount: Number(amount),
      type,
      due_date: dueDate || null,
      paid: false
    })
    setIsAdding(false)
    setName('')
    setAmount('')
    setDueDate('')
  }

  const iOwe = debts.filter((d: Debt) => d.type === 'i_owe')
  const oweMe = debts.filter((d: Debt) => d.type === 'owe_me')

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-medium text-text">Debts & Loans</h2>
        <button onClick={() => setIsAdding(true)} className="flex items-center gap-1.5 text-sm bg-accent/10 text-accent px-3 py-1.5 rounded-lg hover:bg-accent/20 transition-colors">
          <Plus size={16} /> Add Debt
        </button>
      </div>

      {isAdding && (
        <div className="bg-surface p-4 rounded-xl border border-border space-y-3">
          <div className="flex gap-2 p-1 bg-surface-2 rounded-lg border border-border">
            <button type="button" onClick={() => setType('i_owe')} className={`flex-1 py-1.5 text-sm rounded-md transition-colors ${type === 'i_owe' ? 'bg-surface text-text shadow-sm' : 'text-text-muted hover:text-text-secondary'}`}>I Owe</button>
            <button type="button" onClick={() => setType('owe_me')} className={`flex-1 py-1.5 text-sm rounded-md transition-colors ${type === 'owe_me' ? 'bg-surface text-text shadow-sm' : 'text-text-muted hover:text-text-secondary'}`}>Owed to Me</button>
          </div>
          <input type="text" placeholder="Person or Entity Name" value={name} onChange={e => setName(e.target.value)} className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm" />
          <div className="grid grid-cols-2 gap-3">
            <input type="number" placeholder="Amount" value={amount} onChange={e => setAmount(e.target.value)} className="bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm" />
            <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-text-muted" />
          </div>
          <div className="flex gap-2 justify-end mt-2">
            <button onClick={() => setIsAdding(false)} className="px-4 py-2 text-sm text-text-muted hover:text-text">Cancel</button>
            <button onClick={handleAdd} className="px-4 py-2 text-sm bg-accent text-white rounded-lg">Save</button>
          </div>
        </div>
      )}

      {debts.length === 0 ? (
        <EmptyState icon={<CreditCard size={40} />} title="No debts" message="Keep track of money you owe or are owed." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-warning border-b border-border pb-2 flex justify-between">
              I Owe
              <span>{iOwe.filter((d: Debt) => !d.paid).reduce((s: number, d: Debt) => s + d.amount, 0).toFixed(2)} {currency}</span>
            </h3>
            {iOwe.map((d: Debt) => (
              <div key={d.id} className={`flex items-center justify-between p-3 rounded-lg border ${d.paid ? 'bg-surface-2/50 border-transparent opacity-60' : 'bg-surface border-border'}`}>
                <div>
                  <p className={`font-medium ${d.paid ? 'line-through text-text-muted' : 'text-text'}`}>{d.name}</p>
                  {d.due_date && <p className="text-[10px] text-text-muted mt-0.5">{format(new Date(d.due_date), 'MMM d, yyyy')}</p>}
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-medium text-warning">{d.amount.toFixed(2)}</span>
                  <button onClick={() => toggleDebtPaid.mutate({ id: d.id, paid: !d.paid })} className={`p-1.5 rounded-full transition-colors ${d.paid ? 'text-success bg-success/10' : 'text-text-muted hover:text-text bg-surface-2'}`}>
                    <CheckCircle2 size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-medium text-success border-b border-border pb-2 flex justify-between">
              Owed To Me
              <span>{oweMe.filter((d: Debt) => !d.paid).reduce((s: number, d: Debt) => s + d.amount, 0).toFixed(2)} {currency}</span>
            </h3>
            {oweMe.map((d: Debt) => (
              <div key={d.id} className={`flex items-center justify-between p-3 rounded-lg border ${d.paid ? 'bg-surface-2/50 border-transparent opacity-60' : 'bg-surface border-border'}`}>
                <div>
                  <p className={`font-medium ${d.paid ? 'line-through text-text-muted' : 'text-text'}`}>{d.name}</p>
                  {d.due_date && <p className="text-[10px] text-text-muted mt-0.5">{format(new Date(d.due_date), 'MMM d, yyyy')}</p>}
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-medium text-success">{d.amount.toFixed(2)}</span>
                  <button onClick={() => toggleDebtPaid.mutate({ id: d.id, paid: !d.paid })} className={`p-1.5 rounded-full transition-colors ${d.paid ? 'text-success bg-success/10' : 'text-text-muted hover:text-text bg-surface-2'}`}>
                    <CheckCircle2 size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
