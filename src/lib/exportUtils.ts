
import { db } from '../db'
import Papa from 'papaparse'

export async function exportAllDataToCSV() {
  const tables = ['tasks', 'transactions', 'notes', 'inbox_items', 'books', 'goals', 'agenda_blocks', 'daily_records'] as const
  
  const fullJson: Record<string, unknown[]> = {}
  for (const t of tables) {
    fullJson[t] = await db[t].toArray()
  }
  
  const blob = new Blob([JSON.stringify(fullJson, null, 2)], { type: 'application/json' })
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
  if (!data.length) return alert('No transactions to export')
  
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
