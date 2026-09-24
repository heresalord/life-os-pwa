import { useState, useMemo, useEffect } from 'react'
import { format, eachDayOfInterval } from 'date-fns'
import { TrendingDown, TrendingUp, ChevronDown } from 'lucide-react'
import { haptic } from '../../../lib/haptic'
import { useTransactionsRange } from '../../../hooks/useRangeQueries'
import type { Transaction } from '../../../db/schema'
import { PageSkeleton } from '../../../components/Skeleton'
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

  // h-16 = 64px — use pixel heights so percentages don't resolve to 0
  // inside a flex column that has no explicit height of its own.
  const PX = 64

  return (
    <div className="flex items-end w-full h-16 gap-1 sm:gap-1">
      {data.map(d => {
        const showExp = showType !== 'income' && d.expense > 0
        const showInc = showType !== 'expense' && d.income > 0
        const expPx   = Math.max(2, Math.round((d.expense / maxVal) * PX))
        const incPx   = Math.max(2, Math.round((d.income  / maxVal) * PX))

        return (
          <div key={d.date} className="flex-1 flex flex-col-reverse gap-1 items-stretch">
            {showExp && (
              <div className="bg-accent/60 rounded-sm transition-all duration-300" style={{ height: expPx }} />
            )}
            {showInc && (
              <div className="bg-success/50 rounded-sm transition-all duration-300" style={{ height: incPx }} />
            )}
            {!showExp && !showInc && (
              <div className="bg-surface-2 rounded-sm" style={{ height: 3 }} />
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
    <div className="space-y-3">
      {sorted.map(([cat, amt]) => (
        <div key={cat}>
          <div className="flex justify-between text-xs sm:text-sm mb-1.5 font-medium">
            <span className="text-text capitalize">{cat}</span>
            <span className="text-text-secondary tabular-nums">
              {amt.toFixed(2)} <span className="text-text-muted text-xs">{currency}</span>
              <span className="text-text-muted text-xs ml-1">· {Math.round((amt / total) * 100)}%</span>
            </span>
          </div>
          <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden p-0.5">
            <div
              className={clsx('h-full rounded-full transition-all duration-500', type === 'expense' ? 'bg-accent/80' : 'bg-success/70')}
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
  period: 'day' | 'week' | 'month' | 'year' | 'custom'
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

  // Chart data — cap at 31 bars (monthly max), 12 bars (annual max), or a
  // sensible cap for custom ranges so a multi-year selection doesn't render
  // hundreds of illegible slivers.
  const chartData = useMemo(() => {
    if (period === 'day') return []
    const start = new Date(from + 'T12:00:00')
    const end   = new Date(to   + 'T12:00:00')

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

    // A custom range spanning more than ~45 days would render one sliver
    // per day and become illegible — fall back to monthly buckets instead.
    const spanDays = Math.round((end.getTime() - start.getTime()) / 86_400_000)
    if (period === 'custom' && spanDays > 45) {
      const months: { date: string; expense: number; income: number }[] = []
      const cursor = new Date(start.getFullYear(), start.getMonth(), 1)
      const last   = new Date(end.getFullYear(), end.getMonth(), 1)
      while (cursor <= last) {
        const monthPrefix = format(cursor, 'yyyy-MM')
        const monthTxns = txns.filter((t: Transaction) => t.date.startsWith(monthPrefix))
        months.push({
          date: monthPrefix,
          expense: monthTxns.filter(t => t.type === 'expense' && t.category !== 'transfer').reduce((s, t) => s + Number(t.amount), 0),
          income:  monthTxns.filter(t => t.type === 'income'  && t.category !== 'transfer').reduce((s, t) => s + Number(t.amount), 0),
        })
        cursor.setMonth(cursor.getMonth() + 1)
      }
      return months
    }

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
        <PageSkeleton />
      ) : (
        <>
          {/* Net cashflow hero */}
          <div className="bg-surface border border-border rounded-2xl p-5 shadow-xs">
            <p className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-1">Net Cashflow</p>
            <p className={clsx('text-3xl sm:text-4xl font-display font-bold tracking-tight', net >= 0 ? 'text-success' : 'text-danger')}>
              {net >= 0 ? '+' : ''}{net.toFixed(2)}{' '}
              <span className="text-base sm:text-lg text-text-muted font-body font-normal">{currency}</span>
            </p>

            {/* Mini chart inside hero */}
            {chartData.length > 0 && (
              <div className="mt-5 pt-3 border-t border-border/50">
                <MiniBarChart data={chartData} showType={detail || 'both'} />
                <div className="flex items-center justify-between text-[11px] text-text-muted mt-2 px-0.5">
                  <span className="font-medium">{format(new Date(from + 'T12:00:00'), 'MMM d')}</span>
                  <div className="flex items-center gap-3">
                    {(detail !== 'income') && (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-surface-2/80 text-[10px] font-semibold text-text-secondary">
                        <span className="w-1.5 h-1.5 rounded-full bg-accent inline-block" />Spent
                      </span>
                    )}
                    {(detail !== 'expense') && (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-surface-2/80 text-[10px] font-semibold text-text-secondary">
                        <span className="w-1.5 h-1.5 rounded-full bg-success inline-block" />Earned
                      </span>
                    )}
                  </div>
                  <span className="font-medium">{format(new Date(to + 'T12:00:00'), 'MMM d')}</span>
                </div>
              </div>
            )}
          </div>

          {/* Clickable stat cards */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => {
                haptic('light')
                setDetail(detail === 'expense' ? null : 'expense')
              }}
              className={clsx(
                'text-left p-4 rounded-2xl border transition-all active:scale-[0.98] shadow-xs cursor-pointer',
                detail === 'expense' ? 'bg-accent/10 border-accent/40 shadow-sm' : 'bg-surface border-border hover:bg-surface-2/70'
              )}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-lg bg-accent/15 flex items-center justify-center text-accent">
                  <TrendingDown size={14} />
                </div>
                <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Spent</span>
                <ChevronDown size={14} className={clsx('ml-auto text-text-muted transition-transform duration-200', detail === 'expense' && 'rotate-180')} />
              </div>
              <p className="text-xl font-display font-bold text-text">{expenses.toFixed(2)}</p>
              <p className="text-xs text-text-muted mt-0.5">{currency}</p>
            </button>

            <button
              onClick={() => {
                haptic('light')
                setDetail(detail === 'income' ? null : 'income')
              }}
              className={clsx(
                'text-left p-4 rounded-2xl border transition-all active:scale-[0.98] shadow-xs cursor-pointer',
                detail === 'income' ? 'bg-success/10 border-success/40 shadow-sm' : 'bg-surface border-border hover:bg-surface-2/70'
              )}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-lg bg-success/15 flex items-center justify-center text-success">
                  <TrendingUp size={14} />
                </div>
                <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Earned</span>
                <ChevronDown size={14} className={clsx('ml-auto text-text-muted transition-transform duration-200', detail === 'income' && 'rotate-180')} />
              </div>
              <p className="text-xl font-display font-bold text-success">{income.toFixed(2)}</p>
              <p className="text-xs text-text-muted mt-0.5">{currency}</p>
            </button>
          </div>

          {/* Adjustments row (only shown when non-zero) */}
          {adjustments !== 0 && (
            <div className="flex items-center justify-between px-4 py-3 bg-amber-400/8 border border-amber-400/20 rounded-2xl shadow-xs">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
                <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Adjustments</span>
              </div>
              <span className={clsx('text-sm font-semibold', adjustments >= 0 ? 'text-success' : 'text-danger')}>
                {adjustments >= 0 ? '+' : ''}{adjustments.toFixed(2)} {currency}
              </span>
            </div>
          )}

          {/* Expandable breakdown */}
          {detail && (
            <div className="bg-surface border border-border rounded-2xl p-5 shadow-xs animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="flex items-center justify-between mb-4 border-b border-border/40 pb-2">
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
                  {detail === 'expense' ? 'Spending' : 'Income'} Breakdown
                </h3>
                <span className="text-xs font-semibold text-text">
                  {(detail === 'expense' ? expenses : income).toFixed(2)} {currency}
                </span>
              </div>
              <CategoryList txns={txns as Transaction[]} type={detail} currency={currency} />
            </div>
          )}
        </>
      )}
    </div>
  )
}
