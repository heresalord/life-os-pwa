import { useState, useMemo } from 'react'
import { format, subDays } from 'date-fns'
import { useTransactionsRange } from '../../../hooks/useRangeQueries'
import { useTransactionMutations } from '../../../hooks/useTransactionMutations'
import { useScrollToHighlight } from '../../../hooks/useScrollToHighlight'
import { TransactionItem } from '../../../components/finance/TransactionItem'
import { AddTransactionModal } from '../../../components/finance/AddTransactionModal'
import { EmptyState } from '../../../components/EmptyState'
import { TransactionListSkeleton } from '../../../components/Skeleton'
import { DollarSign, Search, X } from 'lucide-react'
import { useAppStore } from '../../../store/useAppStore'
import { getUserLocalDate } from '../../../lib/dateUtils'
import { haptic } from '../../../lib/haptic'
import { SheetSelect } from '../../../components/SheetSelect'
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
  /** Transaction id to scroll to and highlight, from a search deep link. */
  highlightId?: string | null
  /** Add-modal open state, lifted to FinancePage so the header "+" can open it
   *  from any tab (this tab isn't always mounted). */
  addOpen: boolean
  onAddOpenChange: (open: boolean) => void
}

export function TransactionsTab({ currency, from, to, today, highlightId, addOpen, onAddOpenChange }: TransactionsTabProps) {
  const { selectedDate, timezone } = useAppStore()

  const [typeFilter,     setTypeFilter]     = useState<TypeFilter>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [search,         setSearch]         = useState('')

  const { data: txns = [], isLoading } = useTransactionsRange(from, to)

  useScrollToHighlight(highlightId, !isLoading)

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
      {/* Add Transaction — opened via the header's contextual "+" action */}
      <AddTransactionModal date={defaultAddDate} open={addOpen} onOpenChange={onAddOpenChange} />

      {/* Filters */}
      <div className="bg-surface border border-border p-3.5 rounded-2xl space-y-3 shadow-xs">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              placeholder="Search activity..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-surface-2 border border-border rounded-xl pl-8 pr-8 py-2 text-xs text-text placeholder-text-muted focus:outline-none focus:border-accent"
            />
            {search && (
              <button
                onClick={() => {
                  haptic('light')
                  setSearch('')
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text p-0.5"
                aria-label="Clear search"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {allCategories.length > 2 && (
            <div className="w-36 sm:w-44 flex-shrink-0">
              <SheetSelect
                label="Category"
                value={categoryFilter}
                onChange={(cat) => {
                  haptic('light')
                  setCategoryFilter(cat)
                }}
                capitalize
                options={allCategories.map(c => ({ value: c, label: c === 'all' ? 'All categories' : c }))}
              />
            </div>
          )}
        </div>

        {/* Type filter pills */}
        <div className="flex gap-1 bg-surface-2 rounded-xl p-1 overflow-x-auto">
          {(['all', 'expense', 'income', 'adjustment'] as TypeFilter[]).map(t => (
            <button
              key={t}
              onClick={() => {
                haptic('light')
                setTypeFilter(t)
              }}
              className={clsx(
                'flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold capitalize transition-all whitespace-nowrap active:scale-95 cursor-pointer text-center',
                typeFilter === t ? 'bg-bg text-text shadow-xs' : 'text-text-muted hover:text-text'
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Summary card */}
      {filtered.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-surface border border-border rounded-2xl p-4 shadow-xs">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Total Spent</span>
            <p className="text-lg font-display font-bold text-danger mt-0.5">
              −{totals.expense.toFixed(2)} <span className="text-xs font-normal text-text-muted font-body">{currency}</span>
            </p>
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Total Earned</span>
            <p className="text-lg font-display font-bold text-success mt-0.5">
              +{totals.income.toFixed(2)} <span className="text-xs font-normal text-text-muted font-body">{currency}</span>
            </p>
          </div>
          <div className="col-span-2 sm:col-span-1 flex flex-col justify-center sm:border-l sm:border-border/50 sm:pl-3">
            <div className="flex items-center justify-between sm:justify-start gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Activity</span>
              <span className="px-2 py-0.5 rounded-full bg-surface-2 text-[10px] font-bold text-text-secondary">
                {filtered.length} txn{filtered.length !== 1 ? 's' : ''}
              </span>
            </div>
            {totals.adjustment !== 0 && (
              <span className={clsx('text-xs font-semibold mt-0.5', totals.adjustment >= 0 ? 'text-success' : 'text-danger')}>
                {totals.adjustment >= 0 ? '+' : ''}{totals.adjustment.toFixed(2)} {currency} adj.
              </span>
            )}
          </div>
        </div>
      )}

      {/* Transaction list grouped by date */}
      {isLoading ? (
        <TransactionListSkeleton count={6} />
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
              <section key={date} className="relative">
                <div className="flex items-center justify-between mb-2 px-2 sticky top-14 bg-bg/90 backdrop-blur-md py-2 z-10">
                  <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">{dateLabel}</span>
                  <span className={clsx('text-xs font-semibold tabular-nums', dayTotal >= 0 ? 'text-success' : 'text-danger')}>
                    {dayTotal >= 0 ? '+' : ''}{dayTotal.toFixed(2)} {currency}
                  </span>
                </div>
                <div className="space-y-2 lg:grid lg:grid-cols-2 lg:gap-2 lg:space-y-0">
                  {items.map(t => (
                    <div key={t.id} data-item-id={t.id} className="rounded-xl">
                      <TransactionItem
                        transaction={t}
                        onDelete={(id) => deleteTransaction.mutate(id)}
                        currency={currency}
                      />
                    </div>
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
