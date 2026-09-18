import { Download } from 'lucide-react'
import { useDb } from '../db/DbContext'
import { exportTableCSV } from '../lib/exportUtils'
import type { LifeOSDatabase } from '../db'
import { haptic } from '../lib/haptic'

/**
 * A small icon button dropped into a module's header that exports that
 * module's table to CSV. Shared across Tasks, Notes, Books, Goals, Agenda,
 * and Inbox so every module gets the same export affordance and behavior.
 */
export function ExportButton({
  table,
  label,
  className = '',
}: {
  table: keyof LifeOSDatabase & string
  label: string
  className?: string
}) {
  const db = useDb()
  return (
    <button
      onClick={() => { haptic('light'); exportTableCSV(db, table, label) }}
      title={`Export ${label} as CSV`}
      className={`w-9 h-9 flex items-center justify-center rounded-xl bg-surface-2 border border-border text-text-secondary hover:text-text hover:border-text-muted transition-colors flex-shrink-0 ${className}`}
    >
      <Download size={15} />
    </button>
  )
}
