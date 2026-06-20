import React, { useState } from 'react'
import { useWallets } from '../../../hooks/useFinanceQueries'
import { useFinanceMutations } from '../../../hooks/useFinanceMutations'
import { useTransactionMutations } from '../../../hooks/useTransactionMutations'
import { useAppStore } from '../../../store/useAppStore'
import { getUserLocalDate } from '../../../lib/dateUtils'
import type { Wallet } from '../../../db/schema'
import {
  Plus, ArrowLeftRight,
  Landmark, CreditCard, Wallet as WalletIcon, PiggyBank,
  Archive, RotateCcw
} from 'lucide-react'
import clsx from 'clsx'
import * as Dialog from '@radix-ui/react-dialog'

// ── Constants ─────────────────────────────────────────────────────────────────

type SheetMode = 'add_account' | 'transfer' | 'edit_account' | null

const WALLET_COLORS = [
  '#4ade80', '#60a5fa', '#f59e0b', '#f87171',
  '#a78bfa', '#fb923c', '#34d399', '#e879f9',
]

const WALLET_TYPES = [
  { value: 'bank'    as const, label: 'Bank',    icon: Landmark  },
  { value: 'cash'    as const, label: 'Cash',    icon: WalletIcon },
  { value: 'credit'  as const, label: 'Credit',  icon: CreditCard },
  { value: 'savings' as const, label: 'Savings', icon: PiggyBank  },
]

// ── Currency list ─────────────────────────────────────────────────────────────
const COMMON_CURRENCIES = [
  { code: 'USD', symbol: '$',   name: 'US Dollar'      },
  { code: 'EUR', symbol: '€',   name: 'Euro'           },
  { code: 'GBP', symbol: '£',   name: 'British Pound'  },
  { code: 'XOF', symbol: 'CFA', name: 'West African CFA' },
  { code: 'XAF', symbol: 'CFA', name: 'Central African CFA' },
  { code: 'CAD', symbol: '$',   name: 'Canadian Dollar' },
  { code: 'CHF', symbol: 'Fr',  name: 'Swiss Franc'    },
  { code: 'JPY', symbol: '¥',   name: 'Japanese Yen'   },
  { code: 'CNY', symbol: '¥',   name: 'Chinese Yuan'   },
  { code: 'INR', symbol: '₹',   name: 'Indian Rupee'   },
  { code: 'MAD', symbol: 'د.م', name: 'Moroccan Dirham' },
  { code: 'NGN', symbol: '₦',   name: 'Nigerian Naira' },
  { code: 'GHS', symbol: '₵',   name: 'Ghanaian Cedi'  },
  { code: 'KES', symbol: 'KSh', name: 'Kenyan Shilling' },
  { code: 'ZAR', symbol: 'R',   name: 'South African Rand' },
  { code: 'BRL', symbol: 'R$',  name: 'Brazilian Real' },
  { code: 'MXN', symbol: '$',   name: 'Mexican Peso'   },
  { code: 'AUD', symbol: '$',   name: 'Australian Dollar' },
  { code: 'SGD', symbol: '$',   name: 'Singapore Dollar' },
  { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham'     },
]

// ── Add Account Sheet ────────────────────────────────────────────────────────
function AddAccountSheet({ currency: defaultCurrency, onClose }: { currency: string; onClose: () => void }) {
  const { addWallet } = useFinanceMutations()
  const [name, setName]         = useState('')
  const [balance, setBalance]   = useState('0')
  const [type, setType]         = useState<'bank' | 'cash' | 'credit' | 'savings'>('bank')
  const [color, setColor]       = useState(WALLET_COLORS[0])
  const [walletCurrency, setWalletCurrency] = useState(defaultCurrency)

  const handleAdd = () => {
    if (!name.trim()) return
    addWallet.mutate({ name: name.trim(), type, balance: Number(balance), currency: walletCurrency, color })
    onClose()
  }

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-text text-base">New Account</h3>
      <input type="text" placeholder="Account name" value={name} onChange={e => setName(e.target.value)}
        className="w-full bg-surface-2 border border-border rounded-xl px-4 py-3 text-text focus:border-accent outline-none" />
      <div>
        <label className="block text-xs text-text-muted mb-2 uppercase tracking-wider">Type</label>
        <div className="grid grid-cols-4 gap-2">
          {WALLET_TYPES.map(t => {
            const Icon = t.icon
            return (
              <button key={t.value} onClick={() => setType(t.value)}
                className={clsx('flex flex-col items-center gap-1 py-2.5 px-2 rounded-xl border text-xs font-medium transition-all',
                  type === t.value ? 'bg-accent/10 border-accent text-accent' : 'border-border text-text-muted hover:text-text')}>
                <Icon size={18} />{t.label}
              </button>
            )
          })}
        </div>
      </div>
      {/* Currency selector */}
      <div>
        <label className="block text-xs text-text-muted mb-1.5 uppercase tracking-wider">Currency</label>
        <select
          value={walletCurrency}
          onChange={e => setWalletCurrency(e.target.value)}
          className="w-full bg-surface-2 border border-border rounded-xl px-4 py-3 text-text focus:border-accent outline-none appearance-none cursor-pointer text-sm"
        >
          {COMMON_CURRENCIES.map(c => (
            <option key={c.code} value={c.code}>{c.code} — {c.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs text-text-muted mb-1.5 uppercase tracking-wider">Opening Balance ({walletCurrency})</label>
        <input type="number" step="0.01" value={balance} onChange={e => setBalance(e.target.value)}
          className="w-full bg-surface-2 border border-border rounded-xl px-4 py-3 text-text focus:border-accent outline-none" />
      </div>
      <div>
        <label className="block text-xs text-text-muted mb-2 uppercase tracking-wider">Color</label>
        <div className="flex gap-2">
          {WALLET_COLORS.map(c => (
            <button key={c} onClick={() => setColor(c)}
              className={clsx('w-7 h-7 rounded-full transition-transform', color === c ? 'scale-125 ring-2 ring-offset-2 ring-offset-surface ring-white/30' : 'hover:scale-110')}
              style={{ backgroundColor: c }} />
          ))}
        </div>
      </div>
      <div className="flex gap-3 pt-2">
        <button onClick={onClose} className="flex-1 py-3 bg-surface-2 text-text font-medium rounded-xl hover:bg-muted transition-colors">Cancel</button>
        <button onClick={handleAdd} disabled={!name.trim() || addWallet.isPending}
          className="flex-[2] py-3 bg-accent text-bg font-medium rounded-xl hover:bg-accent-dim transition-colors disabled:opacity-50">
          {addWallet.isPending ? 'Adding…' : 'Add Account'}
        </button>
      </div>
    </div>
  )
}

// ── Edit Account Sheet ────────────────────────────────────────────────────────
function EditAccountSheet({
  wallet,
  currency,
  onClose,
}: {
  wallet: Wallet
  currency: string
  onClose: () => void
}) {
  const { timezone } = useAppStore()
  const today = getUserLocalDate(timezone)
  const { updateWallet } = useFinanceMutations()
  const { addTransaction } = useTransactionMutations(today)
  const [name, setName]     = useState(wallet.name)
  const [balance, setBalance] = useState(String(wallet.balance))
  const [type, setType]     = useState<'bank' | 'cash' | 'credit' | 'savings'>(wallet.type)
  const [color, setColor]   = useState(wallet.color || WALLET_COLORS[0])

  const handleSave = () => {
    if (!name.trim()) return

    const newBalanceVal = Number(balance)
    const oldBalanceVal = Number(wallet.balance)
    const diff = newBalanceVal - oldBalanceVal

    // 1. Update basic wallet info
    updateWallet.mutate({
      id: wallet.id,
      updates: { name: name.trim(), type, color },
    })

    // 2. If the balance has changed, record an adjustment transaction
    if (diff !== 0) {
      addTransaction.mutate({
        amount: diff, // signed: positive = balance added, negative = balance reduced
        type: 'adjustment',
        category: 'adjustment',
        description: `Balance adjustment for ${name}`,
        date: today,
        wallet_id: wallet.id,
      })
    }

    onClose()
  }

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-text text-base">Edit Account</h3>
      <input type="text" placeholder="Account name" value={name} onChange={e => setName(e.target.value)}
        className="w-full bg-surface-2 border border-border rounded-xl px-4 py-3 text-text focus:border-accent outline-none" />
      <div>
        <label className="block text-xs text-text-muted mb-2 uppercase tracking-wider">Type</label>
        <div className="grid grid-cols-4 gap-2">
          {WALLET_TYPES.map(t => {
            const Icon = t.icon
            return (
              <button key={t.value} onClick={() => setType(t.value)}
                className={clsx('flex flex-col items-center gap-1 py-2.5 px-2 rounded-xl border text-xs font-medium transition-all',
                  type === t.value ? 'bg-accent/10 border-accent text-accent' : 'border-border text-text-muted hover:text-text')}>
                <Icon size={18} />{t.label}
              </button>
            )
          })}
        </div>
      </div>
      <div>
        <label className="block text-xs text-text-muted mb-1.5 uppercase tracking-wider">Balance ({wallet.currency || currency})</label>
        <input type="number" step="0.01" value={balance} onChange={e => setBalance(e.target.value)}
          className="w-full bg-surface-2 border border-border rounded-xl px-4 py-3 text-text focus:border-accent outline-none" />
        <p className="text-[10px] text-text-muted mt-1 leading-normal">
          Changing this balance will automatically log an "adjustment" transaction to record the difference.
        </p>
      </div>
      <div>
        <label className="block text-xs text-text-muted mb-2 uppercase tracking-wider">Color</label>
        <div className="flex gap-2">
          {WALLET_COLORS.map(c => (
            <button key={c} onClick={() => setColor(c)}
              className={clsx('w-7 h-7 rounded-full transition-transform', color === c ? 'scale-125 ring-2 ring-offset-2 ring-offset-surface ring-white/30' : 'hover:scale-110')}
              style={{ backgroundColor: c }} />
          ))}
        </div>
      </div>
      <div className="flex gap-3 pt-2">
        <button onClick={onClose} className="flex-1 py-3 bg-surface-2 text-text font-medium rounded-xl hover:bg-muted transition-colors">Cancel</button>
        <button onClick={handleSave} disabled={!name.trim() || updateWallet.isPending}
          className="flex-[2] py-3 bg-accent text-bg font-medium rounded-xl hover:bg-accent-dim transition-colors disabled:opacity-50">
          {updateWallet.isPending ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </div>
  )
}

// ── Transfer Sheet ────────────────────────────────────────────────────────────
function TransferSheet({ wallets, currency, onClose }: { wallets: Wallet[]; currency: string; onClose: () => void }) {
  const { timezone } = useAppStore()
  const today = getUserLocalDate(timezone)
  const { addTransaction } = useTransactionMutations(today)
  const [fromId, setFromId] = useState(wallets[0]?.id ?? '')
  const [toId, setToId]     = useState(wallets[1]?.id ?? wallets[0]?.id ?? '')
  const [amount, setAmount] = useState('')

  const handleTransfer = () => {
    const val = parseFloat(amount)
    if (!val || val <= 0 || fromId === toId) return

    const fromWallet = wallets.find(w => w.id === fromId)
    const toWallet   = wallets.find(w => w.id === toId)

    // Record two transactions - these automatically update wallet balances in useTransactionMutations
    addTransaction.mutate({ amount: val, type: 'expense', category: 'transfer', description: `Transfer to ${toWallet?.name}`, date: today, wallet_id: fromId })
    addTransaction.mutate({ amount: val, type: 'income',  category: 'transfer', description: `Transfer from ${fromWallet?.name}`, date: today, wallet_id: toId })

    onClose()
  }

  if (wallets.length < 2) {
    return (
      <div className="text-center py-6">
        <p className="text-sm text-text-muted">You need at least 2 accounts to make a transfer.</p>
        <button onClick={onClose} className="mt-4 px-6 py-2 bg-surface-2 text-text rounded-xl text-sm">Close</button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-text text-base flex items-center gap-2"><ArrowLeftRight size={18} /> Transfer</h3>
      <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center">
        <div>
          <label className="block text-xs text-text-muted mb-1.5 uppercase tracking-wider">From</label>
          <select value={fromId} onChange={e => {
            const newFrom = e.target.value
            setFromId(newFrom)
            // If the new From would match To, pick the first other wallet
            if (newFrom === toId) {
              const fallback = wallets.find(w => w.id !== newFrom)
              setToId(fallback?.id ?? '')
            }
          }}
            className="w-full bg-surface-2 border border-border rounded-xl px-3 py-3 text-sm text-text focus:border-accent outline-none appearance-none">
            {wallets.map(w => <option key={w.id} value={w.id}>{w.name} ({w.currency || currency})</option>)}
          </select>
        </div>
        <ArrowLeftRight size={16} className="text-text-muted mt-5 flex-shrink-0" />
        <div>
          <label className="block text-xs text-text-muted mb-1.5 uppercase tracking-wider">To</label>
          <select value={toId} onChange={e => setToId(e.target.value)}
            className="w-full bg-surface-2 border border-border rounded-xl px-3 py-3 text-sm text-text focus:border-accent outline-none appearance-none">
            {wallets.filter(w => w.id !== fromId).map(w => <option key={w.id} value={w.id}>{w.name} ({w.currency || currency})</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="block text-xs text-text-muted mb-1.5 uppercase tracking-wider">Amount</label>
        <input autoFocus type="number" step="0.01" min="0" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleTransfer()}
          className="w-full bg-surface-2 border border-border rounded-xl px-4 py-3 text-text text-lg focus:border-accent outline-none" />
      </div>
      <div className="flex gap-3 pt-2">
        <button onClick={onClose} className="flex-1 py-3 bg-surface-2 text-text font-medium rounded-xl">Cancel</button>
        <button onClick={handleTransfer} disabled={!amount || fromId === toId}
          className="flex-[2] py-3 bg-accent text-bg font-medium rounded-xl hover:bg-accent-dim transition-colors disabled:opacity-50">
          Transfer
        </button>
      </div>
    </div>
  )
}

// ── Bottom Sheet Wrapper ─────────────────────────────────────────────────────
function Sheet({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-bg/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full sm:max-w-md bg-surface border border-border rounded-t-2xl sm:rounded-2xl p-5 shadow-2xl max-h-[90dvh] overflow-y-auto"
        style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}>
        <div className="w-10 h-1 rounded-full bg-border mx-auto mb-4 sm:hidden" />
        {children}
      </div>
    </div>
  )
}

// ── Main AccountsTab ──────────────────────────────────────────────────────────

export function AccountsTab({ currency }: { currency: string }) {
  const { data: wallets = [] } = useWallets()
  const { updateWallet } = useFinanceMutations()
  const [sheet, setSheet] = useState<SheetMode>(null)
  const [editingWallet, setEditingWallet] = useState<Wallet | null>(null)
  const [archivingWallet, setArchivingWallet] = useState<Wallet | null>(null)
  const [unarchivingWallet, setUnarchivingWallet] = useState<Wallet | null>(null)

  const activeWallets = wallets.filter(w => !w.archived)
  const archivedWallets = wallets.filter(w => w.archived)

  const liquidAccounts  = activeWallets.filter(w => w.type === 'bank' || w.type === 'cash')
  const savingsAccounts = activeWallets.filter(w => w.type === 'savings')
  const debtAccounts    = activeWallets.filter(w => w.type === 'credit')

  // For net worth, we sum numerically (amounts in their own currency — no FX conversion)
  const liquidBalance  = liquidAccounts.reduce((s: number, w: Wallet) => s + Number(w.balance), 0)
  const savingsBalance = savingsAccounts.reduce((s: number, w: Wallet) => s + Number(w.balance), 0)
  const debtBalance    = debtAccounts.reduce((s: number, w: Wallet) => s + Number(w.balance), 0)
  const netWorth = liquidBalance + savingsBalance - debtBalance

  // Detect mixed currencies
  const uniqueCurrencies = [...new Set(activeWallets.map(w => w.currency || currency).filter(Boolean))]
  const hasMixedCurrencies = uniqueCurrencies.length > 1
  const primaryCurrency = uniqueCurrencies[0] || currency

  const renderWalletList = (list: Wallet[], emptyMsg: string) => {
    if (list.length === 0) {
      return <p className="text-sm text-text-muted text-center py-4 bg-surface border border-border rounded-xl">{emptyMsg}</p>
    }
    return (
      <div className="space-y-2">
        {list.map((w: Wallet) => {
          const TypeIcon = WALLET_TYPES.find(t => t.value === w.type)?.icon ?? WalletIcon
          const walletCurrency = w.currency || currency
          return (
            <div key={w.id} onClick={() => { setEditingWallet(w); setSheet('edit_account') }}
              className="flex items-center gap-3 p-4 bg-surface border border-border rounded-xl group transition-all hover:bg-surface-2/40 cursor-pointer select-none">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: (w.color || '#4ade80') + '15' }}>
                <TypeIcon size={18} style={{ color: w.color || '#4ade80' }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-text truncate text-sm">{w.name}</p>
                <p className="text-xs text-text-muted capitalize">{w.type === 'credit' ? 'Debt / Credit' : w.type}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className={clsx('font-semibold text-sm', w.type === 'credit' ? 'text-warning' : Number(w.balance) < 0 ? 'text-danger' : 'text-text')}>
                  {w.type === 'credit' ? '-' : ''}{Number(w.balance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className="text-[10px] font-semibold text-text-muted">{walletCurrency}</p>
              </div>
              <button onClick={(e) => {
                e.stopPropagation()
                setArchivingWallet(w)
              }}
                title="Archive account"
                className="p-1.5 text-text-muted hover:text-accent opacity-0 group-hover:opacity-100 transition-all rounded-lg hover:bg-accent/10">
                <Archive size={14} />
              </button>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Unified Net balance summary */}
      <div className="bg-surface border border-border rounded-2xl p-5 shadow-sm">
        <p className="text-xs text-text-muted uppercase tracking-wider mb-1">Total Net Balance</p>
        <div className="flex items-baseline gap-2">
          <p className={clsx('text-3xl font-display font-medium', netWorth >= 0 ? 'text-text' : 'text-danger')}>
            {netWorth.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            <span className="text-lg text-text-muted ml-1">{primaryCurrency}</span>
          </p>
        </div>
        {hasMixedCurrencies && (
          <p className="text-[10px] text-text-muted mt-1 flex items-center gap-1">
            <span className="w-1 h-1 rounded-full bg-warning inline-block" />
            Accounts span {uniqueCurrencies.length} currencies ({uniqueCurrencies.join(', ')}) — totals shown without FX conversion
          </p>
        )}
        <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-border/60 text-xs">
          <div>
            <p className="text-text-muted text-[10px] uppercase tracking-wider">Liquid</p>
            <p className="font-semibold text-text mt-0.5">{liquidBalance.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-text-muted text-[10px] uppercase tracking-wider">Savings</p>
            <p className="font-semibold text-success mt-0.5">+{savingsBalance.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-text-muted text-[10px] uppercase tracking-wider">Liabilities</p>
            <p className="font-semibold text-warning mt-0.5">-{debtBalance.toFixed(2)}</p>
          </div>
        </div>
      </div>


      {/* Action buttons */}
      <div className="flex gap-2">
        <button onClick={() => setSheet('add_account')}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-surface border border-border rounded-xl text-sm text-text-secondary hover:text-text hover:bg-surface-2 transition-colors">
          <Plus size={16} /> New Account
        </button>
        <button onClick={() => setSheet('transfer')} disabled={wallets.length < 2}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-surface border border-border rounded-xl text-sm text-text-secondary hover:text-text hover:bg-surface-2 transition-colors disabled:opacity-40">
          <ArrowLeftRight size={16} /> Transfer Funds
        </button>
      </div>

      {/* ── Category: Liquid Accounts ── */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider">Cash & Bank Accounts</h2>
        {renderWalletList(liquidAccounts, 'No liquid accounts yet. Add one above.')}
      </section>

      {/* ── Category: Savings Accounts ── */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider">Savings Accounts</h2>
        {renderWalletList(savingsAccounts, 'No savings accounts yet.')}
      </section>

      {/* ── Category: Debt Accounts ── */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider">Debt & Credit Cards</h2>
        {renderWalletList(debtAccounts, 'No debt accounts or credit cards yet.')}
      </section>

      {/* ── Category: Archived Accounts ── */}
      {archivedWallets.length > 0 && (
        <section className="space-y-3 pt-2">
          <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider">Archived Accounts</h2>
          <div className="space-y-2">
            {archivedWallets.map((w: Wallet) => {
              const TypeIcon = WALLET_TYPES.find(t => t.value === w.type)?.icon ?? WalletIcon
              return (
                <div key={w.id}
                  className="flex items-center gap-3 p-4 bg-surface/50 border border-border/65 rounded-xl group transition-all opacity-75 select-none">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: (w.color || '#4ade80') + '10' }}>
                    <TypeIcon size={18} style={{ color: w.color || '#4ade80' }} className="grayscale opacity-60" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-text-secondary truncate text-sm line-through decoration-text-muted">{w.name}</p>
                    <p className="text-xs text-text-muted capitalize">Archived {w.type === 'credit' ? 'Debt / Credit' : w.type}</p>
                  </div>
                  <div className="text-right flex-shrink-0 pr-2">
                    <p className="font-semibold text-sm text-text-muted">
                      {w.type === 'credit' ? '-' : ''}{Number(w.balance).toFixed(2)}
                    </p>
                    <p className="text-[10px] text-text-muted">{w.currency || currency}</p>
                  </div>
                  <button onClick={() => setUnarchivingWallet(w)}
                    title="Unarchive account"
                    className="p-1.5 text-text-muted hover:text-accent rounded-lg hover:bg-accent/10 transition-colors">
                    <RotateCcw size={14} />
                  </button>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* ── Sheets ── */}
      <Sheet open={sheet === 'add_account'} onClose={() => setSheet(null)}>
        <AddAccountSheet currency={currency} onClose={() => setSheet(null)} />
      </Sheet>
      <Sheet open={sheet === 'transfer'} onClose={() => setSheet(null)}>
        <TransferSheet wallets={activeWallets} currency={currency} onClose={() => setSheet(null)} />
      </Sheet>
      <Sheet open={sheet === 'edit_account' && editingWallet !== null} onClose={() => { setSheet(null); setEditingWallet(null) }}>
        {editingWallet && (
          <EditAccountSheet
            wallet={editingWallet}
            currency={currency}
            onClose={() => { setSheet(null); setEditingWallet(null) }}
          />
        )}
      </Sheet>

      {/* Archive Confirmation Sheet */}
      <Dialog.Root open={archivingWallet !== null} onOpenChange={v => { if (!v) setArchivingWallet(null) }}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-bg/80 backdrop-blur-sm" />
          <Dialog.Content
            className="fixed bottom-0 left-0 right-0 z-50 bg-surface border-t border-border rounded-t-2xl p-5 shadow-2xl sm:inset-auto sm:left-1/2 sm:-translate-x-1/2 sm:top-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-sm sm:rounded-2xl sm:border"
            style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
          >
            <div className="w-10 h-1 rounded-full bg-border mx-auto mb-5 sm:hidden" />
            <Dialog.Title className="text-base font-medium text-text mb-1">Archive account?</Dialog.Title>
            {archivingWallet && (
              <p className="text-sm text-text-secondary mb-5">
                Archive <span className="font-medium text-text">"{archivingWallet.name}"</span>?
                It will be hidden from new transaction forms, but all historical transactions will be kept.
              </p>
            )}
            <div className="flex gap-3">
              <button onClick={() => setArchivingWallet(null)}
                className="flex-1 py-3 bg-surface-2 text-text font-medium rounded-xl hover:bg-muted transition-colors">
                Cancel
              </button>
              <button
                onClick={() => {
                  if (archivingWallet) {
                    updateWallet.mutate({ id: archivingWallet.id, updates: { archived: true } })
                    setArchivingWallet(null)
                  }
                }}
                className="flex-[2] py-3 bg-accent/15 text-accent font-medium rounded-xl hover:bg-accent/25 transition-colors"
              >
                Archive
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Unarchive Confirmation Sheet */}
      <Dialog.Root open={unarchivingWallet !== null} onOpenChange={v => { if (!v) setUnarchivingWallet(null) }}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-bg/80 backdrop-blur-sm" />
          <Dialog.Content
            className="fixed bottom-0 left-0 right-0 z-50 bg-surface border-t border-border rounded-t-2xl p-5 shadow-2xl sm:inset-auto sm:left-1/2 sm:-translate-x-1/2 sm:top-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-sm sm:rounded-2xl sm:border"
            style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
          >
            <div className="w-10 h-1 rounded-full bg-border mx-auto mb-5 sm:hidden" />
            <Dialog.Title className="text-base font-medium text-text mb-1">Restore account?</Dialog.Title>
            {unarchivingWallet && (
              <p className="text-sm text-text-secondary mb-5">
                Restore <span className="font-medium text-text">"{unarchivingWallet.name}"</span>?
                It will be active again and show up in all account selectors.
              </p>
            )}
            <div className="flex gap-3">
              <button onClick={() => setUnarchivingWallet(null)}
                className="flex-1 py-3 bg-surface-2 text-text font-medium rounded-xl hover:bg-muted transition-colors">
                Cancel
              </button>
              <button
                onClick={() => {
                  if (unarchivingWallet) {
                    updateWallet.mutate({ id: unarchivingWallet.id, updates: { archived: false } })
                    setUnarchivingWallet(null)
                  }
                }}
                className="flex-[2] py-3 bg-accent text-bg font-medium rounded-xl hover:bg-accent-dim transition-colors"
              >
                Restore
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}
