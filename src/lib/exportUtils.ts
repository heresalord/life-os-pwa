import type { LifeOSDatabase } from '../db'
import Papa from 'papaparse'

/** Trigger a browser download for a Blob. */
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * Generic per-table CSV export — used by every module's "Export" button
 * (Tasks, Notes, Books, Goals, Agenda, Inbox). Flattens nested fields
 * (arrays/objects) to JSON strings so they survive round-tripping through
 * a spreadsheet without breaking columns.
 */
export async function exportTableCSV(
  db: LifeOSDatabase,
  table: keyof LifeOSDatabase & string,
  label: string
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = await (db as any)[table].toArray()
  if (!data.length) { alert(`No ${label.toLowerCase()} to export`); return }

  const flattened = data.map((row: Record<string, unknown>) => {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(row)) {
      out[k] = (v !== null && typeof v === 'object') ? JSON.stringify(v) : v
    }
    return out
  })

  const csv = Papa.unparse(flattened)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  downloadBlob(blob, `${label.toLowerCase().replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`)
}

export async function exportAllDataToJson(db: LifeOSDatabase) {
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

export async function exportTransactionsCSV(db: LifeOSDatabase) {
  return exportTableCSV(db, 'transactions', 'Transactions')
}
