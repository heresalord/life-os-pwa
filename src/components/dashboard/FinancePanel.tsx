
import { useTransactionsQuery } from '../../hooks/useTransactionsQuery'
import { useUserSettings } from '../../hooks/useUserSettings'
import { useAppStore } from '../../store/useAppStore'

export function FinancePanel() {
  const { selectedDate } = useAppStore()
  const { data: txns = [] } = useTransactionsQuery(selectedDate)
  const { data: settings } = useUserSettings()

  const expenses = txns.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
  const income   = txns.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
  const net      = income - expenses
  const budget   = settings?.daily_budget ?? 100
  const budgetPct = Math.min((expenses / budget) * 100, 100)
  const currency  = settings?.currency ?? 'USD'
  const over      = expenses > budget

  const fmt = (n: number) => n.toFixed(2)

  return (
    <div className="bg-surface border border-border rounded-2xl p-4 space-y-3">
      {/* Net */}
      <div className="flex items-baseline justify-between">
        <span className="text-xs text-text-muted">Net today</span>
        <span className={`text-xl font-display font-semibold ${net >= 0 ? 'text-success' : 'text-danger'}`}>
          {net >= 0 ? '+' : ''}{fmt(net)} {currency}
        </span>
      </div>

      {/* Income / Expense row */}
      <div className="flex gap-4 text-sm">
        <div>
          <p className="text-xs text-text-muted">Income</p>
          <p className="text-success font-medium">+{fmt(income)}</p>
        </div>
        <div>
          <p className="text-xs text-text-muted">Spent</p>
          <p className="text-text font-medium">{fmt(expenses)}</p>
        </div>
      </div>

      {/* Budget bar */}
      <div>
        <div className="flex justify-between text-xs text-text-muted mb-1">
          <span>Daily budget</span>
          <span className={over ? 'text-warning' : ''}>{fmt(expenses)} / {fmt(budget)} {currency}</span>
        </div>
        <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${over ? 'bg-warning/70' : 'bg-accent/60'}`}
            style={{ width: `${budgetPct}%` }}
          />
        </div>
      </div>

      {/* Recent transactions */}
      {txns.slice(0, 3).map(t => (
        <div key={t.id} className="flex items-center justify-between text-sm">
          <span className="text-text-secondary capitalize">{t.category}</span>
          <span className={t.type === 'income' ? 'text-success' : 'text-text'}>
            {t.type === 'income' ? '+' : '-'}{fmt(Number(t.amount))}
          </span>
        </div>
      ))}
    </div>
  )
}
