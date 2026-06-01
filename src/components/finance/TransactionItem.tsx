import React, { useRef, useState } from 'react'
import { Trash2, Pencil } from 'lucide-react'
import * as Dialog from '@radix-ui/react-dialog'
import { EditTransactionModal } from './EditTransactionModal'
import type { Transaction } from '../../db/schema'
import clsx from 'clsx'
import { format } from 'date-fns'

interface TransactionItemProps {
  transaction: Transaction
  onDelete: (id: string) => void
  currency: string
}

export function TransactionItem({ transaction, onDelete, currency }: TransactionItemProps) {
  const [swiped, setSwiped] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const touchStartX = useRef<number | null>(null)

  const handleTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX }
  const handleTouchMove  = (e: React.TouchEvent) => {
    if (!touchStartX.current) return
    const diff = touchStartX.current - e.touches[0].clientX
    if (diff > 50)  setSwiped(true)
    if (diff < -50) setSwiped(false)
  }
  const handleTouchEnd = () => { touchStartX.current = null }

  const isIncome = transaction.type === 'income'

  // Extract time from created_at for display
  const timeStr = transaction.created_at
    ? format(new Date(transaction.created_at), 'HH:mm')
    : null

  return (
    <>
      <div className="relative overflow-hidden rounded-xl bg-surface border border-border group">
        {/* Swipe-reveal action buttons */}
        <div className="absolute inset-y-0 right-0 flex items-center gap-1 px-3 bg-surface-2 w-32">
          <button
            onClick={() => { setSwiped(false); setEditOpen(true) }}
            className="p-2 text-accent hover:bg-accent/10 rounded-lg transition-colors"
          >
            <Pencil size={16} />
          </button>
          <button
            onClick={() => { setSwiped(false); setDeleteOpen(true) }}
            className="p-2 text-danger hover:bg-danger/10 rounded-lg transition-colors"
          >
            <Trash2 size={16} />
          </button>
        </div>

        {/* Main row */}
        <div
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className={clsx(
            'relative flex items-center justify-between p-4 bg-surface transition-transform duration-200 ease-out',
            swiped ? '-translate-x-32' : 'translate-x-0'
          )}
        >
          <div className="flex flex-col min-w-0 flex-1 pr-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-text capitalize">{transaction.category}</span>
              <span className={clsx(
                'text-[10px] uppercase tracking-wider font-medium px-1.5 py-0.5 rounded',
                isIncome ? 'bg-success/15 text-success' : 'bg-surface-2 text-text-muted'
              )}>
                {transaction.type}
              </span>
            </div>
            {transaction.description && (
              <span className="text-xs text-text-muted truncate mt-0.5">{transaction.description}</span>
            )}
            {/* Date + time */}
            <span className="text-[10px] text-text-muted mt-1">
              {transaction.date}{timeStr ? ` · ${timeStr}` : ''}
            </span>
          </div>

          <div className={clsx(
            'text-base font-display font-medium flex-shrink-0',
            isIncome ? 'text-success' : 'text-text'
          )}>
            {isIncome ? '+' : '-'}{Number(transaction.amount).toFixed(2)}{' '}
            <span className="text-xs text-text-muted">{currency}</span>
          </div>
        </div>

        {/* Desktop: hover action buttons (no swipe needed) */}
        <div className="hidden group-hover:flex absolute right-3 top-1/2 -translate-y-1/2 items-center gap-1 md:flex opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => setEditOpen(true)}
            className="p-1.5 text-text-muted hover:text-accent hover:bg-accent/10 rounded-lg transition-colors"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={() => setDeleteOpen(true)}
            className="p-1.5 text-text-muted hover:text-danger hover:bg-danger/10 rounded-lg transition-colors"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Edit modal */}
      <EditTransactionModal
        transaction={transaction}
        open={editOpen}
        onClose={() => setEditOpen(false)}
      />

      {/* Delete confirmation */}
      <Dialog.Root open={deleteOpen} onOpenChange={v => { if (!v) setDeleteOpen(false) }}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-bg/80 backdrop-blur-sm" />
          <Dialog.Content
            className="fixed bottom-0 left-0 right-0 z-50 bg-surface border-t border-border rounded-t-2xl p-5 shadow-2xl sm:inset-auto sm:left-1/2 sm:-translate-x-1/2 sm:top-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-sm sm:rounded-2xl sm:border"
            style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
          >
            <div className="w-10 h-1 rounded-full bg-border mx-auto mb-5 sm:hidden" />
            <Dialog.Title className="text-base font-medium text-text mb-1">Delete transaction?</Dialog.Title>
            <p className="text-sm text-text-secondary mb-5">
              <span className="font-medium text-text capitalize">{transaction.category}</span>
              {' · '}{isIncome ? '+' : '-'}{Number(transaction.amount).toFixed(2)} {currency}
              {' · '}{transaction.date}{timeStr ? ` at ${timeStr}` : ''}
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteOpen(false)}
                className="flex-1 py-3 bg-surface-2 text-text font-medium rounded-xl hover:bg-muted transition-colors">
                Cancel
              </button>
              <button onClick={() => { setDeleteOpen(false); onDelete(transaction.id) }}
                className="flex-[2] py-3 bg-danger/15 text-danger font-medium rounded-xl hover:bg-danger/25 transition-colors">
                Delete
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  )
}
