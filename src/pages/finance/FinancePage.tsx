import { useState, useMemo } from 'react'
import { subDays, format, eachDayOfInterval } from 'date-fns'
import { useTransactionsQuery } from '../../hooks/useTransactionsQuery'
import { useTransactionsRange } from '../../hooks/useRangeQueries'
import { useTransactionMutations } from '../../hooks/useTransactionMutations'
import { useUserSettings } from '../../hooks/useUserSettings'
import { useAppStore } from '../../store/useAppStore'
import { getUserLocalDate } from '../../lib/dateUtils'
import { TransactionItem } from '../../components/finance/TransactionItem'
import { AddTransactionModal } from '../../components/finance/AddTransactionModal'
import { EmptyState } from '../../components/EmptyState'
import { DollarSign, TrendingUp, TrendingDown, Wallet } from 'lucide-react'

type Period = 'today' | 'week' | 'month'

function BarChart({ data, currency }: { data: { date: string; expense: number; income: number }[]; currency: string }) {
  const maxVal = Math.max(...data.map(d => Math.max(d.expense, d.income)), 1)
  return (
    <div className="space-y-3">
      <div className="flex items-end gap-1 h-28">
        {data.map(d => (
          <div key={d.date} className="flex-1 flex flex-col items-center gap-0.5 h-full justify-end">
            <div className="w-full flex gap-0.5 items-end h-full justify-center">
              {d.income > 0 && (
                <div className="flex-1 bg-success/50 rounded-t-sm transition-all"
                  style={{ height: `${(d.income / maxVal) * 100}%` }} />
              )}
              {d.expense > 0 && (
                <div className="flex-1 bg-accent/60 rounded-t-sm transition-all"
                  style={{ height: `${(d.expense / maxVal) * 100}%` }} />
              )}
              {d.income === 0 && d.expense === 0 && (
                <div className="flex-1 bg-surface-2 rounded-t-sm h-1" />
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-end gap-1">
        {data.map(d => (
          <div key={d.date} className="flex-1 text-center">
            <span className="text-[9px] text-text-muted">{format(new Date(d.date + 'T12:00:00'), 'dd')}</span>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-4 text-xs text-text-muted">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-accent/60 inline-block" />Expense</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-success/50 inline-block" />Income</span>
        <span className="ml-auto text-text-muted">{currency}</span>
      </div>
    </div>
  )
}

function CategoryBreakdown({ txns, type, currency }: {
  txns: { category: string; amount: number; type: string }[]
  type: 'expense' | 'income'
  currency: string
}) {
  const filtered = txns.filter(t => t.type === type)
  const total = filtered.reduce((s, t) => s + Number(t.amount), 0)
  const byCategory: Record<string, number> = {}
  for (const t of filtered) {
    byCategory[t.category] = (byCategory[t.category] || 0) + Number(t.amount)
  }
  const sorted = Object.entries(byCategory).sort((a, b) => b[1] - a[1])
  if (!sorted.length) return null

  return (
    <div className="space-y-2">
      {sorted.map(([cat, amt]) => (
        <div key={cat}>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-text capitalize">{cat}</span>
            <span className="text-text-secondary">{amt.toFixed(2)} {currency} · {Math.round((amt / total) * 100)}%</span>
          </div>
          <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${type === 'expense' ? 'bg-accent/60' : 'bg-success/50'}`}
              style={{ width: `${(amt / total) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}

export function FinancePage() {
  const { selectedDate, timezone } = useAppStore()
  const today = getUserLocalDate(timezone)
  const [period, setPeriod] = useState<Period>('today')
  const { data: todayTxns = [], isLoading: loadingToday } = useTransactionsQuery(selectedDate)
  const { deleteTransaction } = useTransactionMutations(selectedDate)
  const { data: settings } = useUserSettings()

  const budget   = settings?.daily_budget ?? 100
  const currency = settings?.currency ?? 'USD'

  const weekFrom  = getUserLocalDate(timezone, subDays(new Date(today + 'T12:00:00'), 6))
  const monthFrom = getUserLocalDate(timezone, subDays(new Date(today + 'T12:00:00'), 29))
  const { data: weekTxns  = [] } = useTransactionsRange(weekFrom, today)
  const { data: monthTxns = [] } = useTransactionsRange(monthFrom, today)

  const txns      = period === 'today' ? todayTxns : period === 'week' ? weekTxns : monthTxns
  const isLoading = loadingToday

  const expenses     = txns.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
  const income       = txns.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
  const net          = income - expenses
  const budgetTotal  = period === 'today' ? budget : period === 'week' ? budget * 7 : budget * 30
  const budgetPct    = Math.min((expenses / budgetTotal) * 100, 100)
  const over         = expenses > budgetTotal
  const periodLabel  = period === 'today' ? 'today' : period === 'week' ? 'this week' : 'this month'

  const chartData = useMemo(() => {
    if (period === 'today') return []
    const days = eachDayOfInterval({
      start: new Date((period === 'week' ? weekFrom : monthFrom) + 'T12:00:00'),
      end:   new Date(today + 'T12:00:00'),
    })
    return days.map(d => {
      const dateStr = format(d, 'yyyy-MM-dd')
      const dayTxns = txns.filter(t => t.date === dateStr)
      return {
        date: dateStr,
        expense: dayTxns.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0),
        income:  dayTxns.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0),
      }
    })
  }, [txns, period, today, weekFrom, monthFrom])

  return (
    <div className="space-y-5 lg:max-w-5xl">
      <header>
        <h1 className="text-2xl font-display text-text">Finance</h1>
      </header>

      {/* Period tabs */}
      <div className="flex p-1 bg-surface-2 border border-border rounded-xl">
        {(['today', 'week', 'month'] as Period[]).map(p => (
          <button key={p} onClick={() => setPeriod(p)}
            className={`flex-1 py-2 text-sm font-medium rounded-lg capitalize transition-colors ${
              period === p ? 'bg-surface text-text shadow-sm' : 'text-text-muted hover:text-text-secondary'
            }`}>
            {p === 'week' ? '7 days' : p === 'month' ? '30 days' : 'Today'}
          </button>
        ))}
      </div>

      {/* ── Desktop stat cards row ── */}
      <div className="hidden lg:grid lg:grid-cols-3 gap-4">
        <div className="bg-surface border border-border rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <TrendingDown size={16} className="text-accent" />
            <span className="text-xs text-text-muted uppercase tracking-wider">Spent {periodLabel}</span>
          </div>
          <p className="text-3xl font-display font-medium text-text">{expenses.toFixed(2)}</p>
          <p className="text-xs text-text-muted mt-1">{currency}</p>
        </div>
        <div className="bg-surface border border-border rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp size={16} className="text-success" />
            <span className="text-xs text-text-muted uppercase tracking-wider">Earned {periodLabel}</span>
          </div>
          <p className="text-3xl font-display font-medium text-success">{income > 0 ? '+' : ''}{income.toFixed(2)}</p>
          <p className="text-xs text-text-muted mt-1">{currency}</p>
        </div>
        <div className="bg-surface border border-border rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Wallet size={16} className={over ? 'text-warning' : 'text-text-muted'} />
            <span className="text-xs text-text-muted uppercase tracking-wider">Net {periodLabel}</span>
          </div>
          <p className={`text-3xl font-display font-medium ${net >= 0 ? 'text-success' : 'text-danger'}`}>
            {net >= 0 ? '+' : ''}{net.toFixed(2)}
          </p>
          <div className="mt-2">
            <div className="flex justify-between text-xs text-text-muted mb-1">
              <span>Budget {Math.round(budgetPct)}%</span>
              {over && <span className="text-warning font-medium">Over</span>}
            </div>
            <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${over ? 'bg-warning/80' : 'bg-accent/80'}`}
                style={{ width: `${budgetPct}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Mobile summary card (hidden on desktop — replaced by stat cards above) ── */}
      <div className="lg:hidden bg-surface border border-border rounded-2xl p-5 space-y-4">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-text-muted">Net {periodLabel}</span>
          <span className={`text-3xl font-display font-medium ${net >= 0 ? 'text-success' : 'text-danger'}`}>
            {net >= 0 ? '+' : ''}{net.toFixed(2)} <span className="text-sm text-text-muted">{currency}</span>
          </span>
        </div>
        <div className="flex gap-4 text-sm bg-surface-2 p-3 rounded-xl border border-border">
          <div className="flex-1">
            <p className="text-xs text-text-muted mb-0.5">Income</p>
            <p className="text-success font-medium">+{income.toFixed(2)}</p>
          </div>
          <div className="w-px bg-border" />
          <div className="flex-1">
            <p className="text-xs text-text-muted mb-0.5">Spent</p>
            <p className="text-text font-medium">{expenses.toFixed(2)}</p>
          </div>
          <div className="w-px bg-border" />
          <div className="flex-1">
            <p className="text-xs text-text-muted mb-0.5">Budget</p>
            <p className={`font-medium ${over ? 'text-warning' : 'text-text'}`}>{budgetTotal.toFixed(0)}</p>
          </div>
        </div>
        <div>
          <div className="flex justify-between text-xs text-text-muted mb-1.5">
            <span>Budget used</span>
            <span className={over ? 'text-warning font-medium' : ''}>{Math.round(budgetPct)}%{over ? ' · Over budget' : ''}</span>
          </div>
          <div className="h-2 bg-surface-2 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all ${over ? 'bg-warning/80' : 'bg-accent/80'}`}
              style={{ width: `${budgetPct}%` }} />
          </div>
        </div>
        {period !== 'today' && chartData.length > 0 && (
          <div className="pt-2 border-t border-border">
            <BarChart data={chartData} currency={currency} />
          </div>
        )}
      </div>

      {/* Bar chart on desktop — shown in its own card */}
      {period !== 'today' && chartData.length > 0 && (
        <div className="hidden lg:block bg-surface border border-border rounded-2xl p-5">
          <h2 className="text-xs text-text-muted uppercase tracking-wider mb-4">Daily breakdown</h2>
          <BarChart data={chartData} currency={currency} />
        </div>
      )}

      {/* Category breakdown */}
      {period !== 'today' && txns.length > 0 && (
        <div className="bg-surface border border-border rounded-2xl p-5 space-y-4 lg:grid lg:grid-cols-2 lg:gap-6 lg:space-y-0">
          <div className="space-y-3">
            <h2 className="text-sm font-medium text-text">Expenses by category</h2>
            <CategoryBreakdown txns={txns as { category: string; amount: number; type: string }[]} type="expense" currency={currency} />
          </div>
          {income > 0 && (
            <div className="space-y-3 border-t border-border pt-4 lg:border-t-0 lg:pt-0 lg:border-l lg:pl-6">
              <h2 className="text-sm font-medium text-text">Income by category</h2>
              <CategoryBreakdown txns={txns as { category: string; amount: number; type: string }[]} type="income" currency={currency} />
            </div>
          )}
        </div>
      )}

      {period === 'today' && <AddTransactionModal date={selectedDate} />}

      {/* Transaction list */}
      {period === 'today' && (
        isLoading ? (
          <div className="flex justify-center p-8"><div className="w-6 h-6 border-2 border-accent/30 border-t-accent rounded-full animate-spin" /></div>
        ) : todayTxns.length === 0 ? (
          <EmptyState icon={<DollarSign size={40} />} title="No transactions yet" message="Log your first expense or income for today." />
        ) : (
          <div className="space-y-2 lg:grid lg:grid-cols-2 lg:gap-2 lg:space-y-0">
            {todayTxns.map(t => (
              <TransactionItem key={t.id} transaction={t as Parameters<typeof TransactionItem>[0]['transaction']}
                onDelete={(id) => deleteTransaction.mutate(id)} currency={currency} />
            ))}
          </div>
        )
      )}

      {period !== 'today' && txns.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-medium text-text-secondary px-1">All transactions</h2>
          <div className="lg:grid lg:grid-cols-2 lg:gap-2 space-y-2 lg:space-y-0">
            {[...txns].reverse().map(t => (
              <TransactionItem key={t.id} transaction={t as Parameters<typeof TransactionItem>[0]['transaction']}
                onDelete={() => {}} currency={currency} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
