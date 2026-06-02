
import { useTransactionsQuery } from '../../hooks/useTransactionsQuery'
import { useUserSettings } from '../../hooks/useUserSettings'
import { useAppStore } from '../../store/useAppStore'

export function FinancePanel() {
  const { selectedDate } = useAppStore()
  const { data: txns = [] } = useTransactionsQuery(selectedDate)
  const { data: settings } = useUserSettings()

  const expenses    = txns.filter(t => t.type === 'expense'    && t.category !== 'transfer').reduce((s, t) => s + Number(t.amount), 0)
  const income      = txns.filter(t => t.type === 'income'     && t.category !== 'transfer').reduce((s, t) => s + Number(t.amount), 0)
  const adjustments = txns.filter(t => t.type === 'adjustment'                             ).reduce((s, t) => s + Number(t.amount), 0)
  const net         = income - expenses + adjustments
  const currency  = settings?.currency ?? 'USD'

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

      {/* Recent transactions */}
      {txns.slice(0, 3).map(t => {
        const isIncome     = t.type === 'income'
        const isAdjustment = t.type === 'adjustment'
        const adjAmt       = Number(t.amount)
        const display = isAdjustment
          ? (adjAmt >= 0 ? '+' : '') + fmt(adjAmt)
          : (isIncome ? '+' : '-') + fmt(Math.abs(adjAmt))
        return (
          <div key={t.id} className="flex items-center justify-between text-sm">
            <span className="text-text-secondary capitalize">{t.category}</span>
            <span className={isAdjustment ? 'text-amber-400' : isIncome ? 'text-success' : 'text-text'}>
              {display}
            </span>
          </div>
        )
      })}
    </div>
  )
}
