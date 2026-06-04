import { useState, useMemo, useEffect } from 'react'
import { format, eachDayOfInterval } from 'date-fns'
import { TrendingDown, TrendingUp, ChevronDown } from 'lucide-react'
import { useTransactionsRange } from '../../../hooks/useRangeQueries'
import type { Transaction } from '../../../db/schema'
import clsx from 'clsx'

function MiniBarChart({
  data,
  showType,
}: {
  data: { date: string; expense: number; income: number }[]
  showType: 'expense' | 'income' | 'both'
}) {
  const maxVal = useMemo(() => {
    if (showType === 'expense') return Math.max(...data.map(d => d.expense), 1)
    if (showType === 'income') return Math.max(...data.map(d => d.income), 1)
    return Math.max(...data.map(d => d.expense + d.income), 1)
  }, [data, showType])

  const show = data.filter(d => d.expense > 0 || d.income > 0).length > 0
  if (!show) return null

  return (
    <div className="flex items-end w-full h-16 gap-0.5 sm:gap-1">
      {data.map(d => {
        const hasExpense = showType !== 'income' && d.expense > 0
        const hasIncome = showType !== 'expense' && d.income > 0

        return (
          <div key={d.date} className="flex-1 flex flex-col-reverse gap-0.5 items-stretch justify-start">
            {hasExpense && (
              <div
                className="bg-accent/60 rounded transition-all"
                style={{ height: `${(d.expense / maxVal) * 100}%` }}
              />
            )}
            {hasIncome && (
              <div
                className="bg-success/50 rounded transition-all"
                style={{ height: `${(d.income / maxVal) * 100}%` }}
              />
            )}
            {!hasExpense && !hasIncome && (
              <div className="bg-surface-2 rounded-sm" style={{ height: '4px' }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

function CategoryList({
  txns,
  type,
  currency,
}: {
  txns: Transaction[]
  type: 'expense' | 'income'
  currency: string
}) {
  const filtered = txns.filter(t => t.type === type && t.category !== 'transfer')
  const total    = filtered.reduce((s, t) => s + Number(t.amount), 0)
  if (!filtered.length) return <p className="text-xs text-text-muted text-center py-4">No {type}s in this period</p>

  const byCategory: Record<string, number> = {}
  for (const t of filtered) byCategory[t.category] = (byCategory[t.category] || 0) + Number(t.amount)
  const sorted = Object.entries(byCategory).sort((a, b) => b[1] - a[1])

  return (
    <div className="space-y-2.5">
      {sorted.map(([cat, amt]) => (
        <div key={cat}>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-text capitalize">{cat}</span>
            <span className="text-text-secondary tabular-nums">
              {amt.toFixed(2)} <span className="text-text-muted text-xs">{currency}</span>
              <span className="text-text-muted text-xs ml-1">· {Math.round((amt / total) * 100)}%</span>
            </span>
          </div>
          <div className="h-1 bg-surface-2 rounded-full overflow-hidden">
            <div
              className={clsx('h-full rounded-full transition-all duration-500', type === 'expense' ? 'bg-accent/70' : 'bg-success/60')}
              style={{ width: `${(amt / total) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

interface OverviewTabProps {
  currency: string
  from: string
  to: string
  period: 'day' | 'week' | 'month' | 'year'
}

export function OverviewTab({ currency, from, to, period }: OverviewTabProps) {
  const [detail, setDetail] = useState<'expense' | 'income' | null>(null)
  const { data: txns = [], isLoading } = useTransactionsRange(from, to)

  // Close the breakdown panel whenever the viewed date range changes so the
  // user never sees a stale category list for the previous period.
  useEffect(() => { setDetail(null) }, [from, to])

  const expenses    = txns.filter((t: Transaction) => t.type === 'expense'   && t.category !== 'transfer').reduce((s, t) => s + Number(t.amount), 0)
  const income      = txns.filter((t: Transaction) => t.type === 'income'    && t.category !== 'transfer').reduce((s, t) => s + Number(t.amount), 0)
  const adjustments = txns.filter((t: Transaction) => t.type === 'adjustment'                           ).reduce((s, t) => s + Number(t.amount), 0)
  const net         = income - expenses + adjustments

  // Chart data — cap at 31 bars (monthly max) or 12 bars (annual max)
  const chartData = useMemo(() => {
    if (period === 'day') return []
    const start = new Date(from + 'T12:00:00')
    
    if (period === 'year') {
      const result = []
      for (let m = 0; m < 12; m++) {
        const yearStr = start.getFullYear()
        const monthNum = String(m + 1).padStart(2, '0')
        const monthPrefix = `${yearStr}-${monthNum}`
        const monthTxns = txns.filter((t: Transaction) => t.date.startsWith(monthPrefix))
        result.push({
          date: monthPrefix,
          expense: monthTxns.filter(t => t.type === 'expense' && t.category !== 'transfer').reduce((s, t) => s + Number(t.amount), 0),
          income:  monthTxns.filter(t => t.type === 'income'  && t.category !== 'transfer').reduce((s, t) => s + Number(t.amount), 0),
        })
      }
      return result
    }

    const end   = new Date(to   + 'T12:00:00')
    const days  = eachDayOfInterval({ start, end })
    return days.map(d => {
      const ds      = format(d, 'yyyy-MM-dd')
      const dayTxns = txns.filter((t: Transaction) => t.date === ds)
      return {
        date: ds,
        expense: dayTxns.filter(t => t.type === 'expense' && t.category !== 'transfer').reduce((s, t) => s + Number(t.amount), 0),
        income:  dayTxns.filter(t => t.type === 'income'  && t.category !== 'transfer').reduce((s, t) => s + Number(t.amount), 0),
      }
    })
  }, [txns, from, to, period])

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {isLoading ? (
        <div className="flex justify-center p-8"><div className="w-6 h-6 border-2 border-accent/30 border-t-accent rounded-full animate-spin" /></div>
      ) : (
        <>
          {/* Net cashflow hero */}
          <div className="bg-surface border border-border rounded-2xl p-5">
            <p className="text-xs text-text-muted uppercase tracking-wider mb-1">Net Cashflow</p>
            <p className={clsx('text-4xl font-display font-medium', net >= 0 ? 'text-success' : 'text-danger')}>
              {net >= 0 ? '+' : ''}{net.toFixed(2)}{' '}
              <span className="text-lg text-text-muted font-body font-normal">{currency}</span>
            </p>

            {/* Mini chart inside hero */}
            {chartData.length > 0 && (
              <div className="mt-4">
                <MiniBarChart data={chartData} showType={detail || 'both'} />
                <div className="flex justify-between text-[10px] text-text-muted mt-1">
                  <span>{format(new Date(from + 'T12:00:00'), 'MMM d')}</span>
                  <span className="flex gap-3">
                    {(detail !== 'income') && (
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-sm bg-accent/60 inline-block" />Spent
                      </span>
                    )}
                    {(detail !== 'expense') && (
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-sm bg-success/50 inline-block" />Earned
                      </span>
                    )}
                  </span>
                  <span>{format(new Date(to + 'T12:00:00'), 'MMM d')}</span>
                </div>
              </div>
            )}
          </div>

          {/* Clickable stat cards */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setDetail(detail === 'expense' ? null : 'expense')}
              className={clsx(
                'text-left p-4 rounded-2xl border transition-all',
                detail === 'expense' ? 'bg-accent/10 border-accent/40' : 'bg-surface border-border hover:bg-surface-2'
              )}
            >
              <div className="flex items-center gap-2 mb-2">
                <TrendingDown size={15} className="text-accent" />
                <span className="text-xs text-text-muted uppercase tracking-wider">Spent</span>
                <ChevronDown size={13} className={clsx('ml-auto text-text-muted transition-transform', detail === 'expense' && 'rotate-180')} />
              </div>
              <p className="text-xl font-display font-medium text-text">{expenses.toFixed(2)}</p>
              <p className="text-xs text-text-muted">{currency}</p>
            </button>

            <button
              onClick={() => setDetail(detail === 'income' ? null : 'income')}
              className={clsx(
                'text-left p-4 rounded-2xl border transition-all',
                detail === 'income' ? 'bg-success/10 border-success/40' : 'bg-surface border-border hover:bg-surface-2'
              )}
            >
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp size={15} className="text-success" />
                <span className="text-xs text-text-muted uppercase tracking-wider">Earned</span>
                <ChevronDown size={13} className={clsx('ml-auto text-text-muted transition-transform', detail === 'income' && 'rotate-180')} />
              </div>
              <p className="text-xl font-display font-medium text-success">{income.toFixed(2)}</p>
              <p className="text-xs text-text-muted">{currency}</p>
            </button>
          </div>

          {/* Adjustments row (only shown when non-zero) */}
          {adjustments !== 0 && (
            <div className="flex items-center justify-between px-4 py-3 bg-amber-400/8 border border-amber-400/20 rounded-2xl">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
                <span className="text-xs text-text-muted uppercase tracking-wider">Adjustments</span>
              </div>
              <span className={clsx('text-sm font-medium', adjustments >= 0 ? 'text-amber-400' : 'text-amber-400')}>
                {adjustments >= 0 ? '+' : ''}{adjustments.toFixed(2)} {currency}
              </span>
            </div>
          )}

          {/* Expandable breakdown */}
          {detail && (
            <div className="bg-surface border border-border rounded-2xl p-5 animate-in fade-in slide-in-from-top-2 duration-200">
              <h3 className="text-sm font-medium text-text mb-4 capitalize">
                {detail === 'expense' ? 'Spending' : 'Income'} breakdown
              </h3>
              <CategoryList txns={txns as Transaction[]} type={detail} currency={currency} />
            </div>
          )}
        </>
      )}
    </div>
  )
}
