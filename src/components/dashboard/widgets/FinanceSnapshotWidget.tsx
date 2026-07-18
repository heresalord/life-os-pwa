import { useNavigate } from 'react-router-dom'
import { DollarSign, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { useTransactionsQuery } from '../../../hooks/useTransactionsQuery'
import { useUserSettings } from '../../../hooks/useUserSettings'
import { useAppStore } from '../../../store/useAppStore'
import clsx from 'clsx'

export function FinanceSnapshotWidget() {
  const navigate = useNavigate()
  const { selectedDate } = useAppStore()
  const { data: txns = [], isLoading } = useTransactionsQuery(selectedDate)
  const { data: settings } = useUserSettings()

  const expenses = txns.filter(t => t.type === 'expense' && t.category !== 'transfer').reduce((s, t) => s + Number(t.amount), 0)
  const income = txns.filter(t => t.type === 'income' && t.category !== 'transfer').reduce((s, t) => s + Number(t.amount), 0)
  const adjustments = txns.filter(t => t.type === 'adjustment').reduce((s, t) => s + Number(t.amount), 0)
  const net = income - expenses + adjustments

  const currency = settings?.currency ?? 'USD'
  const dailyBudget = settings?.daily_budget ?? 100.00
  const budgetPct = dailyBudget > 0 ? Math.round((expenses / dailyBudget) * 100) : 0

  const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  return (
    <div
      onClick={() => navigate('/finance')}
      className="bg-surface border border-border rounded-2xl p-4.5 flex flex-col justify-between h-full cursor-pointer hover:border-accent/40 hover:shadow-sm transition-all group"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2.5 flex-shrink-0">
        <div className="flex items-center gap-2">
          <DollarSign size={15} className="text-accent group-hover:scale-110 transition-transform" />
          <span className="font-semibold text-text uppercase tracking-wider text-[11px]">Finance Snapshot</span>
        </div>
        <span className="text-[10px] bg-surface-2 px-2 py-0.5 rounded-full font-medium">Daily</span>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col justify-between gap-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <div className="w-5 h-5 border-2 border-accent/20 border-t-accent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Net Today */}
            <div className="flex justify-between items-baseline">
              <span className="text-xs text-text-muted">Net today</span>
              <span className={clsx(
                "font-display font-semibold text-xl tracking-tight flex items-center gap-1",
                net >= 0 ? "text-success" : "text-danger"
              )}>
                {net >= 0 ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                {net >= 0 ? '+' : ''}{fmt(net)} <span className="text-xs font-body font-medium text-text-muted ml-0.5">{currency}</span>
              </span>
            </div>

            {/* Budget % Progress */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-[10px] text-text-muted font-medium">
                <span>Daily Budget ({fmt(dailyBudget)} {currency})</span>
                <span className={clsx(
                  "font-bold",
                  budgetPct > 100 ? "text-danger" : budgetPct > 80 ? "text-warning" : "text-text-secondary"
                )}>{budgetPct}% spent</span>
              </div>
              <div className="h-1.5 bg-surface-2 border border-border/40 rounded-full overflow-hidden">
                <div
                  className={clsx(
                    "h-full rounded-full transition-all duration-500",
                    budgetPct > 100 ? "bg-danger" : budgetPct > 80 ? "bg-warning" : "bg-success"
                  )}
                  style={{ width: `${Math.min(budgetPct, 100)}%` }}
                />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
