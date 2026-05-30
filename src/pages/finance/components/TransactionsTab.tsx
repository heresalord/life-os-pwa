import { useState } from 'react'
import { useTransactionsRange } from '../../../hooks/useRangeQueries'
import { useTransactionMutations } from '../../../hooks/useTransactionMutations'
import { TransactionItem } from '../../../components/finance/TransactionItem'
import { AddTransactionModal } from '../../../components/finance/AddTransactionModal'
import { EmptyState } from '../../../components/EmptyState'
import { DollarSign } from 'lucide-react'
import { useAppStore } from '../../../store/useAppStore'
import { getUserLocalDate } from '../../../lib/dateUtils'
import { subDays } from 'date-fns'

export function TransactionsTab({ currency }: { currency: string }) {
  const { selectedDate, timezone } = useAppStore()
  const today = getUserLocalDate(timezone)
  const monthFrom = getUserLocalDate(timezone, subDays(new Date(today + 'T12:00:00'), 30))
  const { data: txns = [], isLoading } = useTransactionsRange(monthFrom, today)
  const { deleteTransaction } = useTransactionMutations(selectedDate)

  const [searchTerm, setSearchTerm] = useState('')

  const filteredTxns = txns.filter(t => 
    t.category.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (t.description || '').toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex justify-between gap-4">
        <input 
          type="text" 
          placeholder="Search transactions..."
          className="flex-1 bg-surface border border-border rounded-xl px-4 py-2 text-sm text-text focus:border-accent/50 outline-none transition-colors"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <AddTransactionModal date={selectedDate} />
      </div>

      {isLoading ? (
        <div className="flex justify-center p-8"><div className="w-6 h-6 border-2 border-accent/30 border-t-accent rounded-full animate-spin" /></div>
      ) : filteredTxns.length === 0 ? (
        <EmptyState icon={<DollarSign size={40} />} title="No transactions found" message="Log an expense or income." />
      ) : (
        <div className="space-y-2">
          {[...filteredTxns].reverse().map(t => (
            <TransactionItem key={t.id} transaction={t as any}
              onDelete={(id) => deleteTransaction.mutate(id)} currency={currency} />
          ))}
        </div>
      )}
    </div>
  )
}
