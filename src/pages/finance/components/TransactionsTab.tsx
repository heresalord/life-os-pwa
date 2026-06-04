import { useState, useMemo } from 'react'
import { format, subDays } from 'date-fns'
import { useTransactionsRange } from '../../../hooks/useRangeQueries'
import { useTransactionMutations } from '../../../hooks/useTransactionMutations'
import { TransactionItem } from '../../../components/finance/TransactionItem'
import { AddTransactionModal } from '../../../components/finance/AddTransactionModal'
import { EmptyState } from '../../../components/EmptyState'
import { DollarSign, ChevronDown, Search } from 'lucide-react'
import { useAppStore } from '../../../store/useAppStore'
import { getUserLocalDate } from '../../../lib/dateUtils'
import type { Transaction } from '../../../db/schema'
import clsx from 'clsx'

type TypeFilter = 'all' | 'expense' | 'income' | 'adjustment'

interface TransactionsTabProps {
  currency: string
  from: string
  to: string
  /** Today's local date (yyyy-MM-dd) — passed from FinancePage so the prop
   *  is stable and doesn't re-derive timezone on every render. */
  today: string
}

export function TransactionsTab({ currency, from, to, today }: TransactionsTabProps) {
  const { selectedDate, timezone } = useAppStore()

  const [typeFilter,     setTypeFilter]     = useState<TypeFilter>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [search,         setSearch]         = useState('')

  const { data: txns = [], isLoading } = useTransactionsRange(from, to)

  // For delete optimistic updates — the hook only needs any valid date key;
  // selectedDate is fine here since onSettled invalidates all caches anyway.
  const { deleteTransaction } = useTransactionMutations(selectedDate)

  // Default date for new transactions: the end of the viewed period, capped at today.
  // Prevents defaulting to a future date when `to` is e.g. the end of the current month.
  const defaultAddDate = to < today ? to : today

  const allCategories = useMemo(() => {
    const cats = new Set(txns.map((t: Transaction) => t.category))
    return ['all', ...Array.from(cats).sort()]
  }, [txns])

  const filtered = useMemo(() => {
    return txns.filter((t: Transaction) => {
      const matchType   = typeFilter === 'all' || t.type === typeFilter
      const matchCat    = categoryFilter === 'all' || t.category === categoryFilter
      const matchSearch = !search.trim() ||
        t.category.toLowerCase().includes(search.toLowerCase()) ||
        (t.description ?? '').toLowerCase().includes(search.toLowerCase())
      return matchType && matchCat && matchSearch
    })
  }, [txns, typeFilter, categoryFilter, search])

  // Group by date, sorted newest first
  const grouped = useMemo(() => {
    const map = new Map<string, Transaction[]>()
    ;[...filtered]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .forEach(t => {
        const prev = map.get(t.date) ?? []
        map.set(t.date, [...prev, t])
      })
    return Array.from(map.entries())
  }, [filtered])

  const totals = useMemo(() => ({
    expense:    filtered.filter(t => t.type === 'expense'    && t.category !== 'transfer').reduce((s, t) => s + Number(t.amount), 0),
    income:     filtered.filter(t => t.type === 'income'     && t.category !== 'transfer').reduce((s, t) => s + Number(t.amount), 0),
    adjustment: filtered.filter(t => t.type === 'adjustment'                             ).reduce((s, t) => s + Number(t.amount), 0),
  }), [filtered])

  const yesterday = getUserLocalDate(timezone, subDays(new Date(today + 'T12:00:00'), 1))

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Add Transaction — defaults to the period being viewed, never a future date */}
      <div>
        <AddTransactionModal date={defaultAddDate} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[140px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            placeholder="Search activity..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-surface border border-border rounded-xl pl-9 pr-4 py-2 text-sm text-text placeholder-text-muted focus:border-accent/40 focus:bg-surface-2 transition-all outline-none"
          />
        </div>

        <div className="flex bg-surface border border-border rounded-xl p-0.5">
          {(['all', 'expense', 'income', 'adjustment'] as TypeFilter[]).map(t => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={clsx(
                'px-3 py-1.5 text-xs font-medium rounded-lg capitalize transition-all',
                typeFilter === t ? 'bg-surface-2 text-text shadow-sm' : 'text-text-muted hover:text-text-secondary'
              )}
            >
              {t}
            </button>
          ))}
        </div>

        {allCategories.length > 2 && (
          <div className="relative">
            <select
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
              className="appearance-none bg-surface border border-border rounded-xl pl-3 pr-8 py-2 text-xs font-medium text-text capitalize focus:border-accent outline-none cursor-pointer"
            >
              {allCategories.map(c => (
                <option key={c} value={c}>{c === 'all' ? 'All Categories' : c}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
          </div>
        )}
      </div>

      {/* Summary chips */}
      {filtered.length > 0 && (
        <div className="flex flex-wrap gap-2 text-sm">
          <span className="px-3 py-1 bg-danger/10 text-danger rounded-full font-medium">
            −{totals.expense.toFixed(2)} {currency}
          </span>
          {totals.income > 0 && (
            <span className="px-3 py-1 bg-success/10 text-success rounded-full font-medium">
              +{totals.income.toFixed(2)} {currency}
            </span>
          )}
          {totals.adjustment !== 0 && (
            <span className="px-3 py-1 bg-amber-400/10 text-amber-400 rounded-full font-medium">
              {totals.adjustment >= 0 ? '+' : ''}{totals.adjustment.toFixed(2)} {currency} adj.
            </span>
          )}
          <span className="px-3 py-1 bg-surface-2 text-text-muted rounded-full">
            {filtered.length} transaction{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>
      )}

      {/* Transaction list grouped by date */}
      {isLoading ? (
        <div className="flex justify-center p-8">
          <div className="w-6 h-6 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
        </div>
      ) : grouped.length === 0 ? (
        <EmptyState icon={<DollarSign size={40} />} title="No transactions found" message="Try adjusting filters or add one above." />
      ) : (
        <div className="space-y-6">
          {grouped.map(([date, items]) => {
            // Exclude transfers from the daily net so the chip only reflects
            // real cashflow (income minus expenses). Adjustments are signed so
            // they add or subtract directly.
            const dayTotal = items
              .filter(t => t.category !== 'transfer')
              .reduce((s, t) => {
                const amt = Number(t.amount)
                if (t.type === 'expense')    return s - amt
                if (t.type === 'income')     return s + amt
                if (t.type === 'adjustment') return s + amt  // already signed
                return s
              }, 0)

            const dateLabel =
              date === today     ? 'Today' :
              date === yesterday ? 'Yesterday' :
              format(new Date(date + 'T12:00:00'), 'EEE, MMM d')

            return (
              <section key={date}>
                <div className="flex items-center justify-between mb-2 px-1">
                  <span className="text-xs font-medium text-text-muted uppercase tracking-wider">{dateLabel}</span>
                  <span className={clsx('text-xs font-medium', dayTotal >= 0 ? 'text-success' : 'text-danger')}>
                    {dayTotal >= 0 ? '+' : ''}{dayTotal.toFixed(2)} {currency}
                  </span>
                </div>
                <div className="space-y-2 lg:grid lg:grid-cols-2 lg:gap-2 lg:space-y-0">
                  {items.map(t => (
                    <TransactionItem
                      key={t.id}
                      transaction={t}
                      onDelete={(id) => deleteTransaction.mutate(id)}
                      currency={currency}
                    />
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
