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
 * (Tasks, Notes, Books, Goals, Agenda, Inbox, Finance). Flattens nested fields
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

export const ALL_DEXIE_TABLES = [
  'tasks',
  'transactions',
  'notes',
  'inbox_items',
  'books',
  'goals',
  'goal_events',
  'quotes',
  'agenda_blocks',
  'daily_records',
  'wallets',
  'budgets',
  'savings_goals',
  'debts',
  'projects',
  'habit_logs',
  'milestones',
  'reading_goals',
  'notifications',
  'recurring_tasks',
  'user_settings',
  'user_profiles',
] as const

export interface FullBackupPayload {
  schema_version: number
  exported_at: string
  offline_queue: unknown[]
  data: Record<string, unknown[]>
}

/**
 * Export every Dexie table + the raw offline queue to a single JSON backup.
 */
export async function exportAllDataToJson(db: LifeOSDatabase) {
  const data: Record<string, unknown[]> = {}
  for (const t of ALL_DEXIE_TABLES) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data[t] = await (db as any)[t]?.toArray() ?? []
    } catch {
      data[t] = []
    }
  }

  let offlineQueue: unknown[] = []
  try {
    const rawQueue = localStorage.getItem('lifeos-offline-queue')
    if (rawQueue) {
      offlineQueue = JSON.parse(rawQueue)
    }
  } catch {
    offlineQueue = []
  }

  const payload: FullBackupPayload = {
    schema_version: 2,
    exported_at: new Date().toISOString(),
    offline_queue: offlineQueue,
    data,
  }

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  downloadBlob(blob, `life_os_full_backup_${new Date().toISOString().split('T')[0]}.json`)
}

/**
 * Import all data from a backup JSON file directly into Dexie (and restore offline queue).
 */
export async function importAllDataFromJson(
  db: LifeOSDatabase,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rawPayload: any,
  userId: string
): Promise<{ totalImported: number; tableCounts: Record<string, number> }> {
  const isV2 = rawPayload.schema_version === 2 && rawPayload.data
  const isV1 = rawPayload.schema_version === 1 && rawPayload.data
  const source: Record<string, unknown[]> = (isV2 || isV1) ? rawPayload.data : rawPayload

  let totalImported = 0
  const tableCounts: Record<string, number> = {}

  // Restore raw offline queue if present in v2 backup and local queue is empty
  if (Array.isArray(rawPayload.offline_queue) && rawPayload.offline_queue.length > 0) {
    try {
      const existing = localStorage.getItem('lifeos-offline-queue')
      if (!existing || existing === '[]') {
        localStorage.setItem('lifeos-offline-queue', JSON.stringify(rawPayload.offline_queue))
      }
    } catch {
      // ignore
    }
  }

  for (const table of ALL_DEXIE_TABLES) {
    const rows = source[table]
    if (Array.isArray(rows) && rows.length > 0) {
      // Ensure user_id is assigned to current user
      const mapped = rows.map((r: any) => ({
        ...r,
        user_id: r.user_id || userId,
      }))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dexieTable = (db as any)[table]
      if (dexieTable) {
        await dexieTable.bulkPut(mapped)
        totalImported += mapped.length
        tableCounts[table] = mapped.length
      }
    }
  }

  return { totalImported, tableCounts }
}

export async function exportTransactionsCSV(db: LifeOSDatabase) {
  return exportTableCSV(db, 'transactions', 'Transactions')
}
