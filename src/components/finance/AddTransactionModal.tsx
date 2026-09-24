import React, { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Plus, X, Check } from 'lucide-react'
import { useTransactionMutations } from '../../hooks/useTransactionMutations'
import { useUserSettings } from '../../hooks/useUserSettings'
import { useWallets } from '../../hooks/useFinanceQueries'
import { haptic } from '../../lib/haptic'
import { SheetSelect } from '../SheetSelect'
import clsx from 'clsx'

const DEFAULT_CATEGORIES = {
  expense: ['food', 'transport', 'housing', 'utilities', 'entertainment', 'shopping', 'health', 'other'],
  income:  ['salary', 'freelance', 'investment', 'gift', 'other'],
}

function todayStr() { return new Date().toLocaleDateString('en-CA') }
function nowTimeStr() { return new Date().toTimeString().slice(0, 5) }

export function AddTransactionModal({
  date, isFAB = false, open: openProp, onOpenChange,
}: {
  date: string
  isFAB?: boolean
  /** External open state — when provided, no internal trigger button is rendered
   *  and the caller fully controls visibility (used by the header "+" action). */
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const { data: settings } = useUserSettings()
  const { data: wallets = [] } = useWallets()
  const expCats = settings?.expense_categories?.length ? settings.expense_categories : DEFAULT_CATEGORIES.expense
  const incCats = settings?.income_categories?.length ? settings.income_categories : DEFAULT_CATEGORIES.income

  const activeWallets = wallets.filter(w => !w.archived)

  const [openState, setOpenState] = useState(false)
  const isControlled = openProp !== undefined
  const open = isControlled ? openProp : openState
  const [type, setType]             = useState<'expense' | 'income' | 'transfer'>('expense')
  const [amount, setAmount]         = useState('')
  const [showFee, setShowFee]       = useState(false)
  const [fee, setFee]               = useState('')
  const [category, setCategory]     = useState(expCats[0])
  const [description, setDescription] = useState('')
  const [txDate, setTxDate]         = useState(date || todayStr())
  const [txTime, setTxTime]         = useState(nowTimeStr())
  const [walletId, setWalletId]     = useState<string>('')
  const [transferToId, setTransferToId] = useState<string>('')
  const [justSaved, setJustSaved]   = useState(false)

  const { addTransaction } = useTransactionMutations(txDate)

  const handleOpen = (v: boolean) => {
    if (v) {
      setTxDate(date || todayStr())
      setTxTime(nowTimeStr())
      setShowFee(false)
      const active = wallets.filter(w => !w.archived)
      setWalletId(active[0]?.id ?? '')
      setTransferToId(active[1]?.id ?? active[0]?.id ?? '')
    }
    if (isControlled) onOpenChange?.(v)
    else setOpenState(v)
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
        wallet_id: walletId
      })

      // Add income to destination account
      addTransaction.mutate({
        amount: val,
        type: 'income',
        category: 'transfer',
        description: `Transfer from ${fromWallet?.name || 'Account'}`,
        date: txDate,
        time: txTime,
        wallet_id: transferToId
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
        wallet_id: walletId || undefined
      })
    }

    haptic('success')
    setAmount(''); setFee(''); setDescription('')
    setJustSaved(true)
    setTimeout(() => {
      setJustSaved(false)
      if (isControlled) onOpenChange?.(false)
      else setOpenState(false)
    }, 700)
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleOpen}>
      {!isControlled && (
        <Dialog.Trigger asChild>
          {isFAB ? (
            <button
              onClick={() => haptic('light')}
              className="w-14 h-14 rounded-full bg-accent text-bg shadow-xl flex items-center justify-center hover:bg-accent-dim transition-all duration-200 active:scale-95 border border-accent/20"
            >
              <Plus size={24} className="text-bg" />
            </button>
          ) : (
            <button
              onClick={() => haptic('light')}
              className="w-full flex items-center justify-center gap-2 py-3 bg-surface-2 border border-dashed border-border rounded-2xl text-text-secondary hover:text-text hover:border-text-muted transition-all active:scale-[0.99] text-sm font-semibold shadow-xs"
            >
              <Plus size={18} /> Add Transaction
            </button>
          )}
        </Dialog.Trigger>
      )}
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-bg/80 backdrop-blur-sm animate-in fade-in duration-200" />
        <Dialog.Content className="fixed bottom-0 left-0 right-0 z-50 bg-surface border-t border-border rounded-t-3xl p-5 shadow-2xl overflow-y-auto max-h-[90dvh] sm:inset-auto sm:left-1/2 sm:-translate-x-1/2 sm:top-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-md sm:rounded-2xl sm:border animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200"
          style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}>
          <div className="w-10 h-1 rounded-full bg-border mx-auto mb-4 sm:hidden" />
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-base font-bold text-text">New Transaction</Dialog.Title>
            <Dialog.Close
              onClick={() => haptic('light')}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-surface-2 text-text-muted hover:text-text transition-colors active:scale-90"
            >
              <X size={16} />
            </Dialog.Close>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* iOS Segmented Type Control */}
            <div className="grid grid-cols-3 gap-1 p-1 bg-surface-2 border border-border/80 rounded-2xl">
              <button
                type="button"
                onClick={() => {
                  haptic('light')
                  setType('expense')
                  setCategory(expCats[0])
                }}
                className={clsx(
                  'py-2 text-xs font-semibold rounded-xl transition-all duration-200 active:scale-95',
                  type === 'expense' ? 'bg-surface text-text shadow-xs' : 'text-text-muted hover:text-text-secondary'
                )}
              >
                Expense
              </button>
              <button
                type="button"
                onClick={() => {
                  haptic('light')
                  setType('income')
                  setCategory(incCats[0])
                }}
                className={clsx(
                  'py-2 text-xs font-semibold rounded-xl transition-all duration-200 active:scale-95',
                  type === 'income' ? 'bg-surface text-success shadow-xs' : 'text-text-muted hover:text-text-secondary'
                )}
              >
                Income
              </button>
              <button
                type="button"
                onClick={() => {
                  haptic('light')
                  setType('transfer')
                }}
                className={clsx(
                  'py-2 text-xs font-semibold rounded-xl transition-all duration-200 active:scale-95',
                  type === 'transfer' ? 'bg-surface text-accent shadow-xs' : 'text-text-muted hover:text-text-secondary'
                )}
              >
                Transfer
              </button>
            </div>

            {/* Amount / fee hero box */}
            <div className="bg-surface-2/80 border border-border/80 rounded-2xl p-4 text-center shadow-xs">
              <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wider mb-1">Amount</label>
              <input
                autoFocus
                type="number"
                step="0.01"
                min="0"
                required
                placeholder="0.00"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className="w-full text-center bg-transparent text-3xl font-display font-bold text-text placeholder-text-muted/50 focus:outline-none tracking-tight tabular-nums"
              />
              {type !== 'transfer' && (
                <div className="mt-2 pt-2 border-t border-border/40">
                  {!showFee && !fee ? (
                    <button
                      type="button"
                      onClick={() => {
                        haptic('light')
                        setShowFee(true)
                      }}
                      className="text-[11px] font-semibold text-text-muted hover:text-accent transition-colors"
                    >
                      + Add fee / tax
                    </button>
                  ) : (
                    <div className="flex items-center justify-center gap-2">
                      <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Fee:</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={fee}
                        onChange={e => setFee(e.target.value)}
                        className="w-24 bg-surface border border-border rounded-lg px-2 py-1 text-xs text-center text-text focus:border-accent focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          haptic('light')
                          setFee('')
                          setShowFee(false)
                        }}
                        className="text-[11px] text-text-muted hover:text-danger px-1"
                        title="Remove fee"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Date + time */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-text-muted mb-1.5 uppercase tracking-wider">Date</label>
                <input
                  type="date"
                  value={txDate}
                  onChange={e => setTxDate(e.target.value)}
                  className="w-full bg-surface-2 border border-border rounded-xl px-3 py-2.5 text-xs text-text focus:border-accent focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-text-muted mb-1.5 uppercase tracking-wider">Time</label>
                <input
                  type="time"
                  value={txTime}
                  onChange={e => setTxTime(e.target.value)}
                  className="w-full bg-surface-2 border border-border rounded-xl px-3 py-2.5 text-xs text-text focus:border-accent focus:outline-none"
                />
              </div>
            </div>

            {/* Category (hidden for transfers) */}
            {type !== 'transfer' && (
              <div>
                <label className="block text-[11px] font-bold text-text-muted mb-1.5 uppercase tracking-wider">Category</label>
                <SheetSelect
                  label="Category"
                  value={category}
                  onChange={setCategory}
                  capitalize
                  options={(type === 'expense' ? expCats : incCats).map(c => ({ value: c, label: c }))}
                />
              </div>
            )}

            {/* Account selectors (From Account, To Account, or generic Account) */}
            {type === 'transfer' ? (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-text-muted mb-1.5 uppercase tracking-wider">From Account</label>
                  <SheetSelect
                    label="From Account"
                    value={walletId}
                    onChange={(newFrom) => {
                      setWalletId(newFrom)
                      if (newFrom === transferToId) {
                        const fallback = activeWallets.find(w => w.id !== newFrom)
                        setTransferToId(fallback?.id ?? '')
                      }
                    }}
                    options={activeWallets.map(w => ({ value: w.id, label: w.name }))}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-text-muted mb-1.5 uppercase tracking-wider">To Account</label>
                  <SheetSelect
                    label="To Account"
                    value={transferToId}
                    onChange={setTransferToId}
                    options={activeWallets.filter(w => w.id !== walletId).map(w => ({ value: w.id, label: w.name }))}
                  />
                </div>
              </div>
            ) : (
              activeWallets.length > 0 && (
                <div>
                  <label className="block text-[11px] font-bold text-text-muted mb-1.5 uppercase tracking-wider">Account</label>
                  <SheetSelect
                    label="Account"
                    value={walletId}
                    onChange={setWalletId}
                    placeholder="No account"
                    options={[{ value: '', label: 'No account' }, ...activeWallets.map(w => ({ value: w.id, label: w.name }))]}
                  />
                </div>
              )
            )}

            {/* Description */}
            <div>
              <label className="block text-[11px] font-bold text-text-muted mb-1.5 uppercase tracking-wider">Description (optional)</label>
              <input
                type="text"
                placeholder={type === 'transfer' ? 'e.g. Savings allocation' : 'What was this for?'}
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="w-full bg-surface-2 border border-border rounded-xl px-4 py-2.5 text-xs text-text placeholder-text-muted focus:border-accent focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={!amount || addTransaction.isPending || justSaved}
              className={clsx(
                'w-full py-3.5 text-bg font-semibold rounded-2xl transition-all duration-200 flex items-center justify-center gap-2 active:scale-[0.98] shadow-sm disabled:opacity-50 cursor-pointer',
                justSaved ? 'bg-success' : type === 'income' ? 'bg-success hover:bg-success/90' : 'bg-accent hover:bg-accent-dim'
              )}
            >
              {justSaved && <Check size={16} />}
              {justSaved ? 'Saved!' : addTransaction.isPending ? 'Saving…' : 'Save Transaction'}
            </button>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
