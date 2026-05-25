
import { useTransactionsQuery } from '../../hooks/useTransactionsQuery'
import { useTransactionMutations } from '../../hooks/useTransactionMutations'
import { useUserSettings } from '../../hooks/useUserSettings'
import { useAppStore } from '../../store/useAppStore'
import { TransactionItem } from '../../components/finance/TransactionItem'
import { AddTransactionModal } from '../../components/finance/AddTransactionModal'
import { EmptyState } from '../../components/EmptyState'
import { DollarSign } from 'lucide-react'

export function FinancePage() {
  const { selectedDate } = useAppStore()
  const { data: txns = [], isLoading } = useTransactionsQuery(selectedDate)
  const { deleteTransaction } = useTransactionMutations(selectedDate)
  const { data: settings } = useUserSettings()

  const expenses = txns.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
  const income   = txns.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
  const net      = income - expenses
  const budget   = settings?.daily_budget ?? 100
  const currency = settings?.currency ?? 'USD'
  
  const budgetPct = Math.min((expenses / budget) * 100, 100)
  const over      = expenses > budget

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-display text-text">Finance</h1>
      </header>

      {/* Daily Summary Card */}
      <div className="bg-surface border border-border rounded-2xl p-5 space-y-4">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-text-muted">Net today</span>
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
        </div>

        <div>
          <div className="flex justify-between text-xs text-text-muted mb-1.5">
            <span>Daily Budget</span>
            <span className={over ? 'text-warning font-medium' : ''}>{expenses.toFixed(2)} / {budget.toFixed(2)} {currency}</span>
          </div>
          <div className="h-2 bg-surface-2 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${over ? 'bg-warning/80' : 'bg-accent/80'}`}
              style={{ width: `${budgetPct}%` }}
            />
          </div>
        </div>
      </div>

      <AddTransactionModal date={selectedDate} />

      {isLoading ? (
        <div className="flex justify-center p-8"><div className="w-6 h-6 border-2 border-accent/30 border-t-accent rounded-full animate-spin" /></div>
      ) : txns.length === 0 ? (
        <EmptyState
          icon={<DollarSign size={40} />}
          title="No transactions yet"
          message="Log your first expense or income for today."
        />
      ) : (
        <div className="space-y-2">
          {txns.map(t => (
            <TransactionItem 
              key={t.id} 
              transaction={t as any} 
              onDelete={(id) => deleteTransaction.mutate(id)}
              currency={currency}
            />
          ))}
        </div>
      )}
    </div>
  )
}
