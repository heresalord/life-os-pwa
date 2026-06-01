import { useMemo } from 'react'
import { TrendingDown, TrendingUp, Wallet as WalletIcon } from 'lucide-react'
import { format, subDays, eachDayOfInterval } from 'date-fns'
import { useAppStore } from '../../../store/useAppStore'
import { getUserLocalDate } from '../../../lib/dateUtils'
import { useTransactionsRange } from '../../../hooks/useRangeQueries'
import { useUserSettings } from '../../../hooks/useUserSettings'
import { useWallets } from '../../../hooks/useFinanceQueries'
import type { Wallet } from '../../../db/schema'

function BarChart({ data, currency }: { data: { date: string; expense: number; income: number }[]; currency: string }) {
  const maxVal = Math.max(...data.map(d => Math.max(d.expense, d.income)), 1)
  return (
    <div className="space-y-3">
      <div className="flex items-end gap-1 h-28">
        {data.map(d => (
          <div key={d.date} className="flex-1 flex flex-col items-center gap-0.5 h-full justify-end">
            <div className="w-full flex gap-0.5 items-end h-full justify-center">
              {d.income > 0 && <div className="flex-1 bg-success/50 rounded-t-sm" style={{ height: `${(d.income / maxVal) * 100}%` }} />}
              {d.expense > 0 && <div className="flex-1 bg-accent/60 rounded-t-sm" style={{ height: `${(d.expense / maxVal) * 100}%` }} />}
              {d.income === 0 && d.expense === 0 && <div className="flex-1 bg-surface-2 rounded-t-sm h-1" />}
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
        <span className="ml-auto">{currency}</span>
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
  for (const t of filtered) byCategory[t.category] = (byCategory[t.category] || 0) + Number(t.amount)
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
            <div className={`h-full rounded-full ${type === 'expense' ? 'bg-accent/60' : 'bg-success/50'}`} style={{ width: `${(amt / total) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}

export function OverviewTab({ currency }: { currency: string }) {
  const { timezone } = useAppStore()
  const today = getUserLocalDate(timezone)
  const monthFrom = getUserLocalDate(timezone, subDays(new Date(today + 'T12:00:00'), 29))
  const { data: monthTxns = [] } = useTransactionsRange(monthFrom, today)
  const { data: settings } = useUserSettings()
  const { data: wallets = [] } = useWallets()

  const budget = settings?.daily_budget ?? 100
  const expenses  = monthTxns.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
  const income    = monthTxns.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
  const net       = income - expenses
  const budgetTotal = budget * 30
  const budgetPct   = Math.min((expenses / budgetTotal) * 100, 100)
  const over        = expenses > budgetTotal
  const netBalance  = wallets.reduce((s: number, w: Wallet) => s + Number(w.balance), 0)

  const chartData = useMemo(() => {
    const days = eachDayOfInterval({ start: new Date(monthFrom + 'T12:00:00'), end: new Date(today + 'T12:00:00') })
    return days.map(d => {
      const dateStr = format(d, 'yyyy-MM-dd')
      const dayTxns = monthTxns.filter(t => t.date === dateStr)
      return {
        date: dateStr,
        expense: dayTxns.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0),
        income:  dayTxns.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0),
      }
    })
  }, [monthTxns, today, monthFrom])

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Net balance hero */}
      <div className="bg-gradient-to-br from-surface to-surface-2 border border-border rounded-2xl p-6">
        <p className="text-sm font-medium text-text-muted flex items-center gap-2 mb-2">
          <WalletIcon size={16} /> Total Net Balance
        </p>
        <p className="text-4xl font-display font-medium text-text">
          {netBalance.toFixed(2)} <span className="text-xl text-text-muted">{currency}</span>
        </p>
        {wallets.length > 0 && (
          <div className="flex gap-2 mt-4 overflow-x-auto pb-1">
            {wallets.map((w: Wallet) => (
              <div key={w.id} className="flex-shrink-0 bg-surface border border-border rounded-lg px-3 py-2 flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: w.color || '#4ade80' }} />
                <div>
                  <p className="text-[10px] text-text-muted uppercase tracking-wide">{w.name}</p>
                  <p className="text-sm font-medium text-text">{Number(w.balance).toFixed(2)} {w.currency}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-surface border border-border rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3"><TrendingDown size={16} className="text-accent" /><span className="text-xs text-text-muted uppercase tracking-wider">Spent (30d)</span></div>
          <p className="text-2xl lg:text-3xl font-display font-medium text-text">{expenses.toFixed(2)}</p>
          <p className="text-xs text-text-muted mt-1">{currency}</p>
        </div>
        <div className="bg-surface border border-border rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3"><TrendingUp size={16} className="text-success" /><span className="text-xs text-text-muted uppercase tracking-wider">Earned (30d)</span></div>
          <p className="text-2xl lg:text-3xl font-display font-medium text-success">{income > 0 ? '+' : ''}{income.toFixed(2)}</p>
          <p className="text-xs text-text-muted mt-1">{currency}</p>
        </div>
        <div className="hidden lg:block bg-surface border border-border rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3"><WalletIcon size={16} className={over ? 'text-warning' : 'text-text-muted'} /><span className="text-xs text-text-muted uppercase tracking-wider">Net (30d)</span></div>
          <p className={`text-3xl font-display font-medium ${net >= 0 ? 'text-success' : 'text-danger'}`}>{net >= 0 ? '+' : ''}{net.toFixed(2)}</p>
          <div className="mt-2">
            <div className="flex justify-between text-xs text-text-muted mb-1">
              <span>Budget {Math.round(budgetPct)}%</span>
              {over && <span className="text-warning font-medium">Over</span>}
            </div>
            <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${over ? 'bg-warning/80' : 'bg-accent/80'}`} style={{ width: `${budgetPct}%` }} />
            </div>
          </div>
        </div>
      </div>

      {chartData.length > 0 && (
        <div className="bg-surface border border-border rounded-2xl p-5">
          <h2 className="text-xs text-text-muted uppercase tracking-wider mb-4">Daily breakdown (30 days)</h2>
          <BarChart data={chartData} currency={currency} />
        </div>
      )}

      {monthTxns.length > 0 && (
        <div className="bg-surface border border-border rounded-2xl p-5 space-y-4 lg:grid lg:grid-cols-2 lg:gap-6 lg:space-y-0">
          <div className="space-y-3">
            <h2 className="text-sm font-medium text-text">Expenses by category</h2>
            <CategoryBreakdown txns={monthTxns as any} type="expense" currency={currency} />
          </div>
          {income > 0 && (
            <div className="space-y-3 border-t border-border pt-4 lg:border-t-0 lg:pt-0 lg:border-l lg:pl-6">
              <h2 className="text-sm font-medium text-text">Income by category</h2>
              <CategoryBreakdown txns={monthTxns as any} type="income" currency={currency} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
