import { db } from '../db'
import Papa from 'papaparse'

export async function exportAllDataToJson() {
  const tables = ['tasks', 'transactions', 'notes', 'inbox_items', 'books', 'goals', 'goal_events', 'quotes', 'agenda_blocks', 'daily_records'] as const

  const data: Record<string, unknown[]> = {}
  for (const t of tables) {
    data[t] = await db[t].toArray()
  }

  // Versioned wrapper so imports can always detect the format
  const payload = {
    schema_version: 1,
    exported_at: new Date().toISOString(),
    data,
  }

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `life_os_backup_${new Date().toISOString().split('T')[0]}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export async function exportTransactionsCSV() {
  const data = await db.transactions.toArray()
  if (!data.length) { alert('No transactions to export'); return }

  const csv = Papa.unparse(data)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `transactions_${new Date().toISOString().split('T')[0]}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
