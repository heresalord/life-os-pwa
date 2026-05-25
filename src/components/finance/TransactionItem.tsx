
import React, { useRef, useState } from 'react'
import { Trash2 } from 'lucide-react'
import type { Transaction } from '../../db/schema'
import clsx from 'clsx'

interface TransactionItemProps {
  transaction: Transaction
  onDelete: (id: string) => void
  currency: string
}

export function TransactionItem({ transaction, onDelete, currency }: TransactionItemProps) {
  const [swiped, setSwiped] = useState(false)
  const touchStartX = useRef<number | null>(null)

  const handleTouchStart = (e: React.TouchEvent) => touchStartX.current = e.touches[0].clientX
  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartX.current) return
    const diff = touchStartX.current - e.touches[0].clientX
    if (diff > 50) setSwiped(true)
    if (diff < -50) setSwiped(false)
  }
  const handleTouchEnd = () => touchStartX.current = null

  const isIncome = transaction.type === 'income'

  return (
    <div className="relative overflow-hidden rounded-xl bg-surface border border-border group">
      <div className="absolute inset-y-0 right-0 flex items-center justify-end bg-danger/20 px-4 w-full">
        <button onClick={() => onDelete(transaction.id)} className="p-2 text-danger hover:bg-danger/10 rounded-full transition-colors">
          <Trash2 size={18} />
        </button>
      </div>

      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className={clsx(
          "relative flex items-center justify-between p-4 bg-surface transition-transform duration-200 ease-out",
          swiped ? "-translate-x-16" : "translate-x-0"
        )}
      >
        <div className="flex flex-col min-w-0 flex-1 pr-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-text capitalize">{transaction.category}</span>
            <span className={clsx(
              "text-[10px] uppercase tracking-wider font-medium px-1.5 py-0.5 rounded",
              isIncome ? "bg-success/15 text-success" : "bg-surface-2 text-text-muted"
            )}>
              {transaction.type}
            </span>
          </div>
          {transaction.description && (
            <span className="text-xs text-text-muted truncate mt-0.5">{transaction.description}</span>
          )}
        </div>

        <div className={clsx(
          "text-base font-display font-medium flex-shrink-0",
          isIncome ? "text-success" : "text-text"
        )}>
          {isIncome ? '+' : '-'}{Number(transaction.amount).toFixed(2)} <span className="text-xs text-text-muted">{currency}</span>
        </div>
      </div>
    </div>
  )
}
