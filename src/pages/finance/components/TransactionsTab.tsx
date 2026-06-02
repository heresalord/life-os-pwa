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

type TypeFilter = 'all' | 'expense' | 'income'

interface TransactionsTabProps {
  currency: string
  from: string
  to: string
}

export function TransactionsTab({ currency, from, to }: TransactionsTabProps) {
  const { selectedDate, timezone } = useAppStore()
  const today = getUserLocalDate(timezone)

  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [search, setSearch] = useState('')

  const { data: txns = [], isLoading } = useTransactionsRange(from, to)
  const { deleteTransaction } = useTransactionMutations(selectedDate)

  // All unique categories from loaded transactions
  const allCategories = useMemo(() => {
    const cats = new Set(txns.map((t: Transaction) => t.category))
    return ['all', ...Array.from(cats).sort()]
  }, [txns])

  const filtered = useMemo(() => {
    return txns.filter((t: Transaction) => {
      const matchType = typeFilter === 'all' || t.type === typeFilter
      const matchCat  = categoryFilter === 'all' || t.category === categoryFilter
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
    expense: filtered.filter((t: Transaction) => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0),
    income:  filtered.filter((t: Transaction) => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0),
  }), [filtered])

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Floating Action Button for Mobile */}
      <div className="md:hidden fixed bottom-20 right-4 z-40">
        <AddTransactionModal date={selectedDate} isFAB />
      </div>

      {/* Normal Dashed Button for Desktop */}
      <div className="hidden md:block">
        <AddTransactionModal date={selectedDate} />
      </div>

      {/* Filters bar */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
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

        {/* Type Filter */}
        <div className="flex bg-surface border border-border rounded-xl p-0.5">
          {(['all', 'expense', 'income'] as TypeFilter[]).map(t => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={clsx(
                'px-3 py-1.5 text-xs font-medium rounded-lg capitalize transition-all',
                typeFilter === t
                  ? 'bg-surface-2 text-text shadow-sm'
                  : 'text-text-muted hover:text-text-secondary'
              )}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Category Filter */}
        {allCategories.length > 2 && (
          <div className="relative">
            <select
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
              className="appearance-none bg-surface border border-border rounded-xl pl-3 pr-8 py-2 text-xs font-medium text-text capitalize focus:border-accent outline-none cursor-pointer"
            >
              {allCategories.map(c => (
                <option key={c} value={c}>
                  {c === 'all' ? 'All Categories' : c}
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
          </div>
        )}
      </div>

      {/* Summary chips */}
      {filtered.length > 0 && (
        <div className="flex gap-3 text-sm">
          <span className="px-3 py-1 bg-danger/10 text-danger rounded-full font-medium">
            −{totals.expense.toFixed(2)} {currency}
          </span>
          {totals.income > 0 && (
            <span className="px-3 py-1 bg-success/10 text-success rounded-full font-medium">
              +{totals.income.toFixed(2)} {currency}
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
            const dayTotal = items.reduce((s, t) =>
              t.type === 'expense' ? s - Number(t.amount) : s + Number(t.amount), 0)
            const dateLabel = date === today
              ? 'Today'
              : date === getUserLocalDate(timezone, subDays(new Date(today + 'T12:00:00'), 1))
              ? 'Yesterday'
              : format(new Date(date + 'T12:00:00'), 'EEE, MMM d')

            return (
              <section key={date}>
                <div className="flex items-center justify-between mb-2 px-1">
                  <span className="text-xs font-medium text-text-muted uppercase tracking-wider">{dateLabel}</span>
                  <span className={`text-xs font-medium ${dayTotal >= 0 ? 'text-success' : 'text-danger'}`}>
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
