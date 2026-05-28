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
import { DollarSign } from 'lucide-react'

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

  const budget = settings?.daily_budget ?? 100
  const currency = settings?.currency ?? 'USD'

  // Range dates
  const weekFrom  = getUserLocalDate(timezone, subDays(new Date(today + 'T12:00:00'), 6))
  const monthFrom = getUserLocalDate(timezone, subDays(new Date(today + 'T12:00:00'), 29))
  const { data: weekTxns = [] }  = useTransactionsRange(weekFrom, today)
  const { data: monthTxns = [] } = useTransactionsRange(monthFrom, today)

  const txns = period === 'today' ? todayTxns : period === 'week' ? weekTxns : monthTxns
  const isLoading = loadingToday

  const expenses = txns.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
  const income   = txns.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
  const net      = income - expenses
  const budgetTotal = period === 'today' ? budget : period === 'week' ? budget * 7 : budget * 30
  const budgetPct = Math.min((expenses / budgetTotal) * 100, 100)
  const over      = expenses > budgetTotal

  // Bar chart data
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
    <div className="space-y-5">
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

      {/* Summary card */}
      <div className="bg-surface border border-border rounded-2xl p-5 space-y-4">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-text-muted">Net {period === 'today' ? 'today' : period === 'week' ? 'this week' : 'this month'}</span>
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

        {/* Bar chart for week/month */}
        {period !== 'today' && chartData.length > 0 && (
          <div className="pt-2 border-t border-border">
            <BarChart data={chartData} currency={currency} />
          </div>
        )}
      </div>

      {/* Category breakdown for week/month */}
      {period !== 'today' && txns.length > 0 && (
        <div className="bg-surface border border-border rounded-2xl p-5 space-y-4">
          <h2 className="text-sm font-medium text-text">Expenses by category</h2>
          <CategoryBreakdown txns={txns as { category: string; amount: number; type: string }[]} type="expense" currency={currency} />
          {income > 0 && (
            <>
              <h2 className="text-sm font-medium text-text pt-2 border-t border-border">Income by category</h2>
              <CategoryBreakdown txns={txns as { category: string; amount: number; type: string }[]} type="income" currency={currency} />
            </>
          )}
        </div>
      )}

      {period === 'today' && <AddTransactionModal date={selectedDate} />}

      {/* Transaction list — today only */}
      {period === 'today' && (
        isLoading ? (
          <div className="flex justify-center p-8"><div className="w-6 h-6 border-2 border-accent/30 border-t-accent rounded-full animate-spin" /></div>
        ) : todayTxns.length === 0 ? (
          <EmptyState icon={<DollarSign size={40} />} title="No transactions yet" message="Log your first expense or income for today." />
        ) : (
          <div className="space-y-2">
            {todayTxns.map(t => (
              <TransactionItem key={t.id} transaction={t as Parameters<typeof TransactionItem>[0]['transaction']}
                onDelete={(id) => deleteTransaction.mutate(id)} currency={currency} />
            ))}
          </div>
        )
      )}

      {/* Summary list for week/month */}
      {period !== 'today' && txns.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-medium text-text-secondary px-1">All transactions</h2>
          {[...txns].reverse().map(t => (
            <TransactionItem key={t.id} transaction={t as Parameters<typeof TransactionItem>[0]['transaction']}
              onDelete={() => {}} currency={currency} />
          ))}
        </div>
      )}
    </div>
  )
}
