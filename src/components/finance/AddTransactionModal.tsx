import React, { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Plus, X } from 'lucide-react'
import { useTransactionMutations } from '../../hooks/useTransactionMutations'
import { useUserSettings } from '../../hooks/useUserSettings'
import { useWallets } from '../../hooks/useFinanceQueries'
import clsx from 'clsx'

const DEFAULT_CATEGORIES = {
  expense: ['food', 'transport', 'housing', 'utilities', 'entertainment', 'shopping', 'health', 'other'],
  income:  ['salary', 'freelance', 'investment', 'gift', 'other'],
}

function todayStr() { return new Date().toLocaleDateString('en-CA') }
function nowTimeStr() { return new Date().toTimeString().slice(0, 5) }

export function AddTransactionModal({ date, isFAB = false }: { date: string; isFAB?: boolean }) {
  const { data: settings } = useUserSettings()
  const { data: wallets = [] } = useWallets()
  const expCats = settings?.expense_categories?.length ? settings.expense_categories : DEFAULT_CATEGORIES.expense
  const incCats = settings?.income_categories?.length ? settings.income_categories : DEFAULT_CATEGORIES.income

  const [open, setOpen]             = useState(false)
  const [type, setType]             = useState<'expense' | 'income' | 'transfer'>('expense')
  const [amount, setAmount]         = useState('')
  const [fee, setFee]               = useState('')
  const [category, setCategory]     = useState(expCats[0])
  const [description, setDescription] = useState('')
  const [txDate, setTxDate]         = useState(date || todayStr())
  const [txTime, setTxTime]         = useState(nowTimeStr())
  const [walletId, setWalletId]     = useState<string>(wallets[0]?.id ?? '')
  const [transferToId, setTransferToId] = useState<string>('')

  const { addTransaction } = useTransactionMutations(txDate)

  const handleOpen = (v: boolean) => {
    if (v) {
      setTxDate(date || todayStr())
      setTxTime(nowTimeStr())
      setWalletId(wallets[0]?.id ?? '')
      setTransferToId(wallets[1]?.id ?? wallets[0]?.id ?? '')
    }
    setOpen(v)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    let val = parseFloat(amount)
    if (!val || val <= 0) return

    if (type === 'transfer') {
      if (walletId === transferToId) return
      const fromWallet = wallets.find(w => w.id === walletId)
      const toWallet   = wallets.find(w => w.id === transferToId)

      // Add expense to source account
      addTransaction.mutate({
        amount: val,
        type: 'expense',
        category: 'transfer',
        description: `Transfer to ${toWallet?.name || 'Account'}`,
        date: txDate,
        time: txTime,
        method: walletId
      })

      // Add income to destination account
      addTransaction.mutate({
        amount: val,
        type: 'income',
        category: 'transfer',
        description: `Transfer from ${fromWallet?.name || 'Account'}`,
        date: txDate,
        time: txTime,
        method: transferToId
      })
    } else {
      const feeVal = parseFloat(fee) || 0
      if (type === 'expense') val += feeVal
      else val = Math.max(0, val - feeVal)

      addTransaction.mutate({
        amount: val,
        type,
        category,
        description: description.trim() || undefined,
        date: txDate,
        time: txTime,
        method: walletId || undefined
      })
    }

    setAmount(''); setFee(''); setDescription(''); setOpen(false)
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleOpen}>
      <Dialog.Trigger asChild>
        {isFAB ? (
          <button className="w-14 h-14 rounded-full bg-accent text-bg shadow-xl flex items-center justify-center hover:bg-accent-dim transition-all duration-200 active:scale-95 border border-accent/20">
            <Plus size={24} className="text-bg" />
          </button>
        ) : (
          <button className="w-full flex items-center justify-center gap-2 py-3 bg-surface-2 border border-dashed border-border rounded-xl text-text-secondary hover:text-text hover:border-text-muted transition-colors text-sm font-medium">
            <Plus size={18} /> Add Transaction
          </button>
        )}
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-bg/80 backdrop-blur-sm" />
        <Dialog.Content className="fixed bottom-0 left-0 right-0 z-50 bg-surface border-t border-border rounded-t-2xl p-5 shadow-2xl overflow-y-auto max-h-[90dvh] sm:inset-auto sm:left-1/2 sm:-translate-x-1/2 sm:top-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-md sm:rounded-2xl sm:border"
          style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}>
          <div className="w-10 h-1 rounded-full bg-border mx-auto mb-4 sm:hidden" />
          <div className="flex items-center justify-between mb-5">
            <Dialog.Title className="text-base font-semibold text-text">New Transaction</Dialog.Title>
            <Dialog.Close className="text-text-muted hover:text-text transition-colors"><X size={18} /></Dialog.Close>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Type tabs (Expense / Income / Transfer) */}
            <div className="flex p-1 bg-surface-2 rounded-lg gap-0.5">
              <button type="button" onClick={() => { setType('expense'); setCategory(expCats[0]) }}
                className={clsx('flex-1 py-1.5 text-xs font-medium rounded-md transition-colors', type === 'expense' ? 'bg-surface text-text shadow-sm' : 'text-text-muted hover:text-text-secondary')}>
                Expense
              </button>
              <button type="button" onClick={() => { setType('income'); setCategory(incCats[0]) }}
                className={clsx('flex-1 py-1.5 text-xs font-medium rounded-md transition-colors', type === 'income' ? 'bg-success/20 text-success shadow-sm' : 'text-text-muted hover:text-text-secondary')}>
                Income
              </button>
              <button type="button" onClick={() => setType('transfer')}
                className={clsx('flex-1 py-1.5 text-xs font-medium rounded-md transition-colors', type === 'transfer' ? 'bg-accent/20 text-accent shadow-sm' : 'text-text-muted hover:text-text-secondary')}>
                Transfer
              </button>
            </div>

            {/* Amount / fee */}
            <div className="grid grid-cols-2 gap-3">
              <div className={type === 'transfer' ? 'col-span-2' : ''}>
                <label className="block text-xs text-text-muted mb-1.5 uppercase tracking-wider">Amount</label>
                <input autoFocus type="number" step="0.01" min="0" required placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)}
                  className="w-full bg-surface-2 border border-border rounded-xl px-4 py-3 text-text placeholder-text-muted focus:border-accent focus:outline-none" />
              </div>
              {type !== 'transfer' && (
                <div>
                  <label className="block text-xs text-text-muted mb-1.5 uppercase tracking-wider">Fee / Tax</label>
                  <input type="number" step="0.01" min="0" placeholder="0.00" value={fee} onChange={e => setFee(e.target.value)}
                    className="w-full bg-surface-2 border border-border rounded-xl px-4 py-3 text-text placeholder-text-muted focus:border-accent focus:outline-none" />
                </div>
              )}
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

            {/* Category (hidden for transfers) */}
            {type !== 'transfer' && (
              <div>
                <label className="block text-xs text-text-muted mb-1.5 uppercase tracking-wider">Category</label>
                <select value={category} onChange={e => setCategory(e.target.value)}
                  className="w-full bg-surface-2 border border-border rounded-xl px-4 py-3 text-text capitalize focus:border-accent focus:outline-none appearance-none">
                  {(type === 'expense' ? expCats : incCats).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            )}

            {/* Account selectors (From Account, To Account, or generic Account) */}
            {type === 'transfer' ? (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-text-muted mb-1.5 uppercase tracking-wider">From Account</label>
                  <select value={walletId} onChange={e => setWalletId(e.target.value)}
                    className="w-full bg-surface-2 border border-border rounded-xl px-3 py-3 text-sm text-text focus:border-accent outline-none appearance-none">
                    {wallets.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-text-muted mb-1.5 uppercase tracking-wider">To Account</label>
                  <select value={transferToId} onChange={e => setTransferToId(e.target.value)}
                    className="w-full bg-surface-2 border border-border rounded-xl px-3 py-3 text-sm text-text focus:border-accent outline-none appearance-none">
                    {wallets.filter(w => w.id !== walletId).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </div>
              </div>
            ) : (
              wallets.length > 0 && (
                <div>
                  <label className="block text-xs text-text-muted mb-1.5 uppercase tracking-wider">Account</label>
                  <select value={walletId} onChange={e => setWalletId(e.target.value)}
                    className="w-full bg-surface-2 border border-border rounded-xl px-4 py-3 text-text focus:border-accent focus:outline-none appearance-none">
                    <option value="">No account</option>
                    {wallets.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </div>
              )
            )}

            {/* Description */}
            <div>
              <label className="block text-xs text-text-muted mb-1.5 uppercase tracking-wider">Description (optional)</label>
              <input type="text" placeholder={type === 'transfer' ? 'e.g. Savings allocation' : 'What was this for?'} value={description} onChange={e => setDescription(e.target.value)}
                className="w-full bg-surface-2 border border-border rounded-xl px-4 py-3 text-text placeholder-text-muted focus:border-accent focus:outline-none" />
            </div>

            <button type="submit" disabled={!amount || addTransaction.isPending}
              className={clsx('w-full py-3.5 text-bg font-medium rounded-xl transition-colors disabled:opacity-50',
                type === 'income' ? 'bg-success hover:bg-success/90' : type === 'transfer' ? 'bg-accent hover:bg-accent-dim' : 'bg-accent hover:bg-accent-dim')}>
              {addTransaction.isPending ? 'Saving…' : 'Save Transaction'}
            </button>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
