
import React, { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Plus, X } from 'lucide-react'
import { useTransactionMutations } from '../../hooks/useTransactionMutations'

const CATEGORIES = {
  expense: ['food', 'transport', 'housing', 'utilities', 'entertainment', 'shopping', 'health', 'other'],
  income: ['salary', 'freelance', 'investment', 'gift', 'other']
}

export function AddTransactionModal({ date }: { date: string }) {
  const [open, setOpen] = useState(false)
  const [type, setType] = useState<'expense' | 'income'>('expense')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState(CATEGORIES.expense[0])
  const [description, setDescription] = useState('')
  
  const { addTransaction } = useTransactionMutations(date)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const val = parseFloat(amount)
    if (!val || val <= 0) return
    
    addTransaction.mutate({ amount: val, type, category, description: description.trim(), date })
    
    setAmount('')
    setDescription('')
    setOpen(false)
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button className="w-full flex items-center justify-center gap-2 py-3 bg-surface-2 border border-dashed border-border rounded-xl text-text-secondary hover:text-text hover:border-text-muted transition-colors text-sm font-medium">
          <Plus size={18} /> Add Transaction
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-bg/80 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed bottom-0 left-0 right-0 z-50 bg-surface border-t border-border rounded-t-2xl p-5 shadow-2xl sm:inset-auto sm:left-1/2 sm:-translate-x-1/2 sm:top-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-md sm:rounded-2xl sm:border">
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-base font-medium text-text">New Transaction</Dialog.Title>
            <Dialog.Close className="text-text-muted hover:text-text transition-colors">
              <X size={18} />
            </Dialog.Close>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Type Toggle */}
            <div className="flex p-1 bg-surface-2 rounded-lg">
              <button type="button" onClick={() => { setType('expense'); setCategory(CATEGORIES.expense[0]) }}
                className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${type === 'expense' ? 'bg-surface text-text shadow-sm' : 'text-text-muted hover:text-text-secondary'}`}>
                Expense
              </button>
              <button type="button" onClick={() => { setType('income'); setCategory(CATEGORIES.income[0]) }}
                className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${type === 'income' ? 'bg-success/20 text-success shadow-sm' : 'text-text-muted hover:text-text-secondary'}`}>
                Income
              </button>
            </div>

            {/* Amount */}
            <div>
              <label className="block text-xs text-text-muted mb-1.5 uppercase tracking-wider">Amount</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted text-lg">$</span>
                <input
                  autoFocus
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  placeholder="0.00"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  className="w-full bg-surface-2 border border-border rounded-xl pl-8 pr-4 py-3 text-text text-lg placeholder-text-muted focus:border-accent focus:outline-none transition-colors"
                />
              </div>
            </div>
            
            {/* Category */}
            <div>
              <label className="block text-xs text-text-muted mb-1.5 uppercase tracking-wider">Category</label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="w-full bg-surface-2 border border-border rounded-xl px-4 py-3 text-text capitalize focus:border-accent focus:outline-none transition-colors appearance-none"
              >
                {CATEGORIES[type].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs text-text-muted mb-1.5 uppercase tracking-wider">Description (Optional)</label>
              <input
                type="text"
                placeholder="What was this for?"
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="w-full bg-surface-2 border border-border rounded-xl px-4 py-3 text-text placeholder-text-muted focus:border-accent focus:outline-none transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={!amount || addTransaction.isPending}
              className={`w-full text-bg font-medium rounded-xl py-3 mt-2 transition-colors disabled:opacity-50 ${type === 'income' ? 'bg-success hover:bg-success/90' : 'bg-accent hover:bg-accent-dim'}`}
            >
              {addTransaction.isPending ? 'Saving...' : 'Save Transaction'}
            </button>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
