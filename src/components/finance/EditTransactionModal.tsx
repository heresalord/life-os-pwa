import React, { useState, useEffect } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { useTransactionMutations } from '../../hooks/useTransactionMutations'
import { useUserSettings } from '../../hooks/useUserSettings'
import { useWallets } from '../../hooks/useFinanceQueries'
import type { Transaction } from '../../db/schema'

const DEFAULT_CATEGORIES = {
  expense: ['food', 'transport', 'housing', 'utilities', 'entertainment', 'shopping', 'health', 'other'],
  income:  ['salary', 'freelance', 'investment', 'gift', 'other'],
}

interface Props {
  transaction: Transaction
  open: boolean
  onClose: () => void
}

export function EditTransactionModal({ transaction, open, onClose }: Props) {
  const { data: settings } = useUserSettings()
  const { data: wallets = [] } = useWallets()
  const expCats = settings?.expense_categories?.length ? settings.expense_categories : DEFAULT_CATEGORIES.expense
  const incCats = settings?.income_categories?.length ? settings.income_categories : DEFAULT_CATEGORIES.income

  const [type, setType]           = useState<'expense' | 'income'>(transaction.type as 'expense' | 'income')
  const [amount, setAmount]       = useState(String(transaction.amount))
  const [category, setCategory]   = useState(transaction.category)
  const [description, setDescription] = useState(transaction.description ?? '')
  const [txDate, setTxDate]       = useState(transaction.date)
  const [txTime, setTxTime]       = useState(
    transaction.created_at ? new Date(transaction.created_at).toTimeString().slice(0, 5) : '00:00'
  )
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [walletId, setWalletId]   = useState<string>((transaction as any).wallet_id ?? '')

  const { updateTransaction } = useTransactionMutations(transaction.date)

  useEffect(() => {
    if (open) {
      setType(transaction.type as 'expense' | 'income')
      setAmount(String(transaction.amount))
      setCategory(transaction.category)
      setDescription(transaction.description ?? '')
      setTxDate(transaction.date)
      setTxTime(transaction.created_at ? new Date(transaction.created_at).toTimeString().slice(0, 5) : '00:00')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setWalletId((transaction as any).wallet_id ?? '')
    }
  }, [open, transaction])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const val = parseFloat(amount)
    if (!val || val <= 0) return
    updateTransaction.mutate({
      id: transaction.id,
      updates: {
        amount: val,
        type,
        category,
        description: description.trim() || null,
        date: txDate,
        time: txTime,
        wallet_id: walletId || null,
      },
    })
    onClose()
  }

  return (
    <Dialog.Root open={open} onOpenChange={v => { if (!v) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-bg/80 backdrop-blur-sm" />
        <Dialog.Content className="fixed bottom-0 left-0 right-0 z-50 bg-surface border-t border-border rounded-t-2xl p-5 shadow-2xl overflow-y-auto max-h-[90dvh] sm:inset-auto sm:left-1/2 sm:-translate-x-1/2 sm:top-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-md sm:rounded-2xl sm:border"
          style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}>
          <div className="w-10 h-1 rounded-full bg-border mx-auto mb-4 sm:hidden" />
          <div className="flex items-center justify-between mb-5">
            <Dialog.Title className="text-base font-semibold text-text">Edit Transaction</Dialog.Title>
            <button onClick={onClose} className="text-text-muted hover:text-text transition-colors"><X size={18} /></button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Type */}
            <div className="flex p-1 bg-surface-2 rounded-lg">
              <button type="button" onClick={() => { setType('expense'); setCategory(expCats[0]) }}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${type === 'expense' ? 'bg-surface text-text shadow-sm' : 'text-text-muted'}`}>Expense</button>
              <button type="button" onClick={() => { setType('income'); setCategory(incCats[0]) }}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${type === 'income' ? 'bg-success/20 text-success shadow-sm' : 'text-text-muted'}`}>Income</button>
            </div>

            {/* Amount */}
            <div>
              <label className="block text-xs text-text-muted mb-1.5 uppercase tracking-wider">Amount</label>
              <input autoFocus type="number" step="0.01" min="0" required value={amount} onChange={e => setAmount(e.target.value)}
                className="w-full bg-surface-2 border border-border rounded-xl px-4 py-3 text-text focus:border-accent focus:outline-none" />
            </div>

            {/* Date + time */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-text-muted mb-1.5 uppercase tracking-wider">Date</label>
                <input type="date" value={txDate} onChange={e => setTxDate(e.target.value)}
                  className="w-full bg-surface-2 border border-border rounded-xl px-4 py-3 text-text focus:border-accent focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1.5 uppercase tracking-wider">Time</label>
                <input type="time" value={txTime} onChange={e => setTxTime(e.target.value)}
                  className="w-full bg-surface-2 border border-border rounded-xl px-4 py-3 text-text focus:border-accent focus:outline-none" />
              </div>
            </div>

            {/* Category */}
            <div>
              <label className="block text-xs text-text-muted mb-1.5 uppercase tracking-wider">Category</label>
              <select value={category} onChange={e => setCategory(e.target.value)}
                className="w-full bg-surface-2 border border-border rounded-xl px-4 py-3 text-text capitalize focus:border-accent focus:outline-none appearance-none">
                {(type === 'expense' ? expCats : incCats).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {/* Wallet / Account */}
            {wallets.length > 0 && (
              <div>
                <label className="block text-xs text-text-muted mb-1.5 uppercase tracking-wider">Account</label>
                <select value={walletId} onChange={e => setWalletId(e.target.value)}
                  className="w-full bg-surface-2 border border-border rounded-xl px-4 py-3 text-text focus:border-accent focus:outline-none appearance-none">
                  <option value="">No account</option>
                  {wallets.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
            )}

            {/* Description */}
            <div>
              <label className="block text-xs text-text-muted mb-1.5 uppercase tracking-wider">Description (optional)</label>
              <input type="text" placeholder="What was this for?" value={description} onChange={e => setDescription(e.target.value)}
                className="w-full bg-surface-2 border border-border rounded-xl px-4 py-3 text-text placeholder-text-muted focus:border-accent focus:outline-none" />
            </div>

            <button type="submit" disabled={!amount || updateTransaction.isPending}
              className={`w-full py-3.5 text-bg font-medium rounded-xl transition-colors disabled:opacity-50 ${type === 'income' ? 'bg-success hover:bg-success/90' : 'bg-accent hover:bg-accent-dim'}`}>
              {updateTransaction.isPending ? 'Saving…' : 'Save Changes'}
            </button>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
