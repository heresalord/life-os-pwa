/**
 * sync.ts — Phase 1 Durable Outbox & Delta Sync Engine
 *
 * Implements:
 * 1. Dexie v17 durable outbox (`seq++, row_key, table, status, created_at`)
 * 2. Atomic row + outbox writes (never lose queued writes)
 * 3. One-time migration from localStorage `lifeos-offline-queue`
 * 4. Single-flight outbox drain worker with exponential backoff and conflict copies (upsert_note)
 * 5. Incremental cursor-based delta pull per table with merge rules
 * 6. Supabase Realtime channel subscriptions with tombstone support
 * 7. Sync diagnostics tracking (pending, blocked, last_error) in useSyncStore
 */

import { supabase } from './supabase'
import { useSyncStore } from '../store/useSyncStore'
import { Capacitor } from '@capacitor/core'
import { App as CapacitorApp } from '@capacitor/app'
import { queryClient } from './queryClient'
import type { LifeOSDatabase } from '../db'
import type { OutboxRow } from '../db/schema'
import type { RealtimeChannel } from '@supabase/supabase-js'

// ── Synced Tables ─────────────────────────────────────────────────────────────

export const SYNCED_TABLES = [
  'notes',
  'inbox_items',
  'tasks',
  'recurring_tasks',
  'transactions',
  'wallets',
  'budgets',
  'savings_goals',
  'debts',
  'goals',
  'goal_events',
  'habit_logs',
  'milestones',
  'books',
  'quotes',
  'reading_goals',
  'agenda_blocks',
  'daily_records',
  'projects',
  'user_settings',
] as const

export type SyncedTable = typeof SYNCED_TABLES[number]

// ── Types ─────────────────────────────────────────────────────────────────────

export interface OfflineQueueItem {
  id:             string
  table:          string
  op:             'insert' | 'update' | 'delete'
  payload:        Record<string, unknown>
  ts:             number
  retries:        number
  status?:        'pending' | 'blocked'
  last_error?:    string
  next_retry_at?: number
}

const LEGACY_QUEUE_KEY = 'lifeos-offline-queue'
const MAX_ATTEMPTS = 5

// Exponential backoff: 5s, 30s, 2m, 10m
function getBackoffMs(attempts: number): number {
  if (attempts <= 1) return 5_000
  if (attempts === 2) return 30_000
  if (attempts === 3) return 120_000
  return 600_000
}

// Module-level active state
let activeDb: LifeOSDatabase | null = null
let activeUserId: string | null = null
let realtimeChannel: RealtimeChannel | null = null

let intervalId: ReturnType<typeof setInterval> | null = null
let onOnlineHandler:  (() => void) | null = null
let onOfflineHandler: (() => void) | null = null
let onFocusHandler:   (() => void) | null = null
let appStateHandle:   { remove: () => void } | null = null

// In-memory cache of pending row keys (`table:row_id`) to fast-check during pull/realtime
const inMemoryPendingRowKeys = new Set<string>()

// ── Synchronize Store & Pending Cache ─────────────────────────────────────────

async function refreshSyncStoreCounts(db = activeDb): Promise<void> {
  if (!db) return
  try {
    const items = await db.outbox.toArray()
    inMemoryPendingRowKeys.clear()

    let pending = 0
    let blocked = 0
    let lastErr: string | null = null

    for (const item of items) {
      if (item.status === 'blocked') {
        blocked++
      } else {
        pending++
        inMemoryPendingRowKeys.add(item.row_key)
      }
      if (item.last_error) {
        lastErr = item.last_error
      }
    }

    useSyncStore.getState().setSyncCounts({
      pendingCount: pending,
      blockedCount: blocked,
      lastError: lastErr,
    })
  } catch (err) {
    console.warn('[sync] Failed to refresh outbox store counts:', err)
  }
}

// ── One-Time Migration from localStorage to Dexie outbox ──────────────────────

async function migrateLegacyOfflineQueue(db: LifeOSDatabase): Promise<void> {
  try {
    const raw = localStorage.getItem(LEGACY_QUEUE_KEY)
    if (!raw) return

    const items: OfflineQueueItem[] = JSON.parse(raw)
    if (Array.isArray(items) && items.length > 0) {
      console.log(`[sync] Migrating ${items.length} items from localStorage queue to Dexie outbox...`)
      const outboxRows: OutboxRow[] = items.map(i => ({
        id: i.id || crypto.randomUUID(),
        row_key: `${i.table}:${(i.payload?.id as string) || ''}`,
        table: i.table,
        op: i.op,
        row_id: String(i.payload?.id || ''),
        patch: i.payload || {},
        base_updated_at: null,
        attempts: i.retries || 0,
        last_error: i.last_error || null,
        status: i.status === 'blocked' ? 'blocked' : 'pending',
        created_at: new Date(i.ts || Date.now()).toISOString(),
        next_retry_at: i.next_retry_at || 0,
      }))

      await db.outbox.bulkAdd(outboxRows)
      console.log('[sync] Offline queue migrated to Dexie outbox successfully.')
    }
    localStorage.removeItem(LEGACY_QUEUE_KEY)
  } catch (err) {
    console.warn('[sync] Failed to migrate legacy offline queue:', err)
  }
}

// ── Outbox Writer: Atomic Outbox Enqueue ──────────────────────────────────────

export async function enqueueOutboxItem(
  db: LifeOSDatabase,
  table: string,
  op: 'insert' | 'update' | 'delete',
  row_id: string,
  patch: Record<string, unknown>,
  base_updated_at?: string | null
): Promise<void> {
  const rowKey = `${table}:${row_id}`
  const outboxItem: OutboxRow = {
    id: crypto.randomUUID(),
    row_key: rowKey,
    table,
    op,
    row_id,
    patch,
    base_updated_at: base_updated_at || null,
    attempts: 0,
    last_error: null,
    status: 'pending',
    created_at: new Date().toISOString(),
  }

  await db.outbox.add(outboxItem)
  inMemoryPendingRowKeys.add(rowKey)
  await refreshSyncStoreCounts(db)

  // Trigger background drain if online
  if (navigator.onLine) {
    void drainOutbox(db)
  }
}

// Backwards-compatible enqueue called by syncQueue.ts
export async function syncToSupabase(
  table: string,
  operation: 'insert' | 'update' | 'delete',
  payload: Record<string, unknown>
): Promise<void> {
  const rowId = String(payload.id || '')
  if (activeDb) {
    await enqueueOutboxItem(activeDb, table, operation, rowId, payload)
  } else {
    // If db instance not registered yet, fallback to localStorage temporarily
    const q: OfflineQueueItem[] = JSON.parse(localStorage.getItem(LEGACY_QUEUE_KEY) ?? '[]')
    q.push({
      id: crypto.randomUUID(),
      table,
      op: operation,
      payload,
      ts: Date.now(),
      retries: 0,
      status: 'pending',
    })
    localStorage.setItem(LEGACY_QUEUE_KEY, JSON.stringify(q))
  }
}

// ── Single-Flight Outbox Drain Worker ─────────────────────────────────────────

let drainPromise: Promise<void> | null = null

export async function drainOutbox(db = activeDb, force = false): Promise<void> {
  if (!db) return
  if (drainPromise) return drainPromise

  drainPromise = (async () => {
    try {
      if (!navigator.onLine) {
        await refreshSyncStoreCounts(db)
        return
      }

      const items = await db.outbox.orderBy('seq').toArray()
      if (items.length === 0) {
        await refreshSyncStoreCounts(db)
        return
      }

      useSyncStore.getState().setIsSyncing(true)
      const now = Date.now()

      for (const item of items) {
        if (!item.seq) continue

        // Skip blocked items unless forced (e.g. Settings -> "Retry now")
        if (item.status === 'blocked' && !force) continue
        // Skip items in exponential backoff window unless forced
        if (item.next_retry_at && item.next_retry_at > now && !force) continue

        try {
          await pushItemToSupabase(db, item)
          // Delete from outbox only on confirmed success
          await db.outbox.delete(item.seq)
        } catch (err: unknown) {
          const errMsg = (err as Error)?.message || String(err)
          console.warn(`[sync] Failed to sync ${item.table} (attempt ${item.attempts + 1}):`, errMsg)

          const newAttempts = item.attempts + 1
          const isBlocked = newAttempts >= MAX_ATTEMPTS
          const nextRetryAt = Date.now() + getBackoffMs(newAttempts)

          await db.outbox.update(item.seq, {
            attempts: newAttempts,
            status: isBlocked ? 'blocked' : 'pending',
            last_error: errMsg,
            next_retry_at: nextRetryAt,
          })
        }
      }
    } finally {
      drainPromise = null
      useSyncStore.getState().setIsSyncing(false)
      await refreshSyncStoreCounts(db)
    }
  })()

  return drainPromise
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supa = supabase as any

async function pushItemToSupabase(db: LifeOSDatabase, item: OutboxRow): Promise<void> {
  if (item.table === 'notes') {
    if (item.op === 'delete') {
      const { error } = await supa
        .from('notes')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', item.row_id)
      if (error) throw error
    } else {
      // Use upsert_note RPC for server conflict copy resolution
      const { data, error } = await supa.rpc('upsert_note', {
        p_row: item.patch,
        p_base: item.base_updated_at || null,
      })
      if (error) throw error

      if (data?.conflict && data?.note) {
        // Server generated a conflict copy! Insert into Dexie so user sees both
        console.warn(`[sync] Note conflict detected. Saved conflict copy: "${data.note.title}"`)
        await db.notes.put(data.note)
        queryClient.invalidateQueries({ queryKey: ['notes'] })
      } else if (data?.note) {
        // Update local row with authoritative server data
        await db.notes.put(data.note)
      }
    }
  } else {
    // Other tables: soft delete or last-write-wins upsert
    if (item.op === 'delete') {
      const { error } = await supa
        .from(item.table)
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', item.row_id)
      if (error) throw error
    } else {
      const { error } = await supa
        .from(item.table)
        .upsert(item.patch, { onConflict: 'id' })
      if (error) throw error
    }
  }
}

// ── Delta Pull: Incremental Pull per Table ───────────────────────────────────

let pullPromise: Promise<void> | null = null

export async function pullTableDelta(
  db: LifeOSDatabase,
  userId: string,
  table: string
): Promise<void> {
  try {
    const syncState = await db.sync_state.get(table)
    const cursor = syncState?.cursor

    let query = supa
      .from(table)
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: true })
      .limit(500)

    if (cursor) {
      query = query.gt('updated_at', cursor)
    }

    const { data: rows, error } = await query
    if (error) {
      console.warn(`[sync] Failed delta pull for ${table}:`, error.message)
      return
    }

    if (!rows || rows.length === 0) return

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const targetTable = (db as any)[table]
    if (!targetTable) return

    for (const serverRow of rows) {
      const rowKey = `${table}:${serverRow.id}`

      // Merge rule: skip if there is a pending local outbox item for this row
      if (inMemoryPendingRowKeys.has(rowKey)) {
        continue
      }

      if (serverRow.deleted_at) {
        // Tombstone: soft delete propagated
        await targetTable.delete(serverRow.id)
      } else {
        // Apply server row if server is equal or newer
        const local = await targetTable.get(serverRow.id)
        if (!local || !local.updated_at || new Date(serverRow.updated_at) >= new Date(local.updated_at)) {
          await targetTable.put(serverRow)
        }
      }
    }

    const lastRow = rows[rows.length - 1]
    await db.sync_state.put({
      table,
      cursor: lastRow.updated_at,
      last_pull_at: new Date().toISOString(),
    })

    queryClient.invalidateQueries({ queryKey: [table] })
  } catch (err) {
    console.warn(`[sync] Delta pull error for ${table}:`, err)
  }
}

export async function pullAllDeltas(db = activeDb, userId = activeUserId): Promise<void> {
  if (!db || !userId || !navigator.onLine) return
  if (pullPromise) return pullPromise

  pullPromise = (async () => {
    try {
      for (const table of SYNCED_TABLES) {
        await pullTableDelta(db, userId, table)
      }
    } finally {
      pullPromise = null
    }
  })()

  return pullPromise
}

// ── Supabase Realtime Subscription ───────────────────────────────────────────

function setupRealtimeSync(db: LifeOSDatabase, userId: string): void {
  if (realtimeChannel) {
    supabase.removeChannel(realtimeChannel)
    realtimeChannel = null
  }

  const channel = supabase.channel(`lifeos-sync-${userId}`)

  for (const table of SYNCED_TABLES) {
    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table,
        filter: `user_id=eq.${userId}`,
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async (payload: any) => {
        const row = payload.new || payload.old
        if (!row || !row.id) return

        const rowKey = `${table}:${row.id}`
        // Skip if local outbox has pending writes for this row
        if (inMemoryPendingRowKeys.has(rowKey)) return

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const targetTable = (db as any)[table]
        if (!targetTable) return

        try {
          if (payload.eventType === 'DELETE' || row.deleted_at) {
            await targetTable.delete(row.id)
          } else {
            const local = await targetTable.get(row.id)
            if (!local || !local.updated_at || new Date(row.updated_at) >= new Date(local.updated_at)) {
              await targetTable.put(row)
            }
          }
          queryClient.invalidateQueries({ queryKey: [table] })
        } catch (err) {
          console.warn(`[sync] Realtime apply error on ${table}:`, err)
        }
      }
    )
  }

  channel.subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      console.log('[sync] Realtime channels active for synced tables')
    }
  })

  realtimeChannel = channel
}

// ── Public Engine Lifecycle ──────────────────────────────────────────────────

export function startSyncEngine(db?: LifeOSDatabase, userId?: string): void {
  if (db) activeDb = db
  if (userId) activeUserId = userId

  if (intervalId) return

  // Run initial migration and refresh
  if (activeDb) {
    void migrateLegacyOfflineQueue(activeDb).then(() => {
      if (activeDb) void refreshSyncStoreCounts(activeDb)
    })
  }

  // Initial drain and delta pull
  void drainOutbox()
  void pullAllDeltas()

  // Setup Realtime if user is known
  if (activeDb && activeUserId) {
    setupRealtimeSync(activeDb, activeUserId)
  }

  // Periodic poll every 60s
  intervalId = setInterval(() => {
    if (navigator.onLine) {
      void drainOutbox()
      void pullAllDeltas()
    }
  }, 60_000)

  onOnlineHandler = () => {
    useSyncStore.getState().setOnlineStatus(true)
    void drainOutbox()
    void pullAllDeltas()
  }

  onOfflineHandler = () => {
    useSyncStore.getState().setOnlineStatus(false)
  }

  onFocusHandler = () => {
    if (navigator.onLine) {
      queryClient.invalidateQueries({ queryKey: ['notes'] })
      queryClient.invalidateQueries({ queryKey: ['inbox'] })
      void drainOutbox()
      void pullAllDeltas()
    }
  }

  window.addEventListener('online',  onOnlineHandler)
  window.addEventListener('offline', onOfflineHandler)
  window.addEventListener('focus',    onFocusHandler)

  // Capacitor foreground refresh
  if (Capacitor.isNativePlatform()) {
    CapacitorApp.addListener('appStateChange', ({ isActive }) => {
      if (isActive) {
        useSyncStore.getState().setOnlineStatus(navigator.onLine)
        queryClient.invalidateQueries({ queryKey: ['notes'] })
        queryClient.invalidateQueries({ queryKey: ['inbox'] })
        void drainOutbox()
        void pullAllDeltas()
      }
    }).then(handle => {
      appStateHandle = handle
    }).catch(() => { /* ignore */ })
  }
}

export function stopSyncEngine(): void {
  if (intervalId) { clearInterval(intervalId); intervalId = null }
  if (onOnlineHandler)  { window.removeEventListener('online',  onOnlineHandler);  onOnlineHandler  = null }
  if (onOfflineHandler) { window.removeEventListener('offline', onOfflineHandler); onOfflineHandler = null }
  if (onFocusHandler)   { window.removeEventListener('focus',    onFocusHandler);   onFocusHandler   = null }
  if (appStateHandle)   { appStateHandle.remove(); appStateHandle = null }

  if (realtimeChannel) {
    supabase.removeChannel(realtimeChannel)
    realtimeChannel = null
  }
}

// ── Backwards-Compatibility Exports ──────────────────────────────────────────

export async function processSyncQueue(): Promise<void> {
  await drainOutbox()
}

export function readQueue(): OfflineQueueItem[] {
  // Returns legacy queue if any exists in localStorage
  try {
    return JSON.parse(localStorage.getItem(LEGACY_QUEUE_KEY) ?? '[]')
  } catch {
    return []
  }
}

export async function drainOfflineQueue(force = false): Promise<void> {
  await drainOutbox(activeDb, force)
}

export function getQueuedItemsForTable(table: string): OfflineQueueItem[] {
  // Reads from legacy queue for localFirst.ts compatibility
  return readQueue().filter(i => i.table === table)
}

export function hasPendingSync(): boolean {
  return useSyncStore.getState().pendingCount > 0
}

export function hasBlockedSync(): boolean {
  return useSyncStore.getState().blockedCount > 0
}

export async function retryBlockedItems(): Promise<void> {
  if (!activeDb) return
  const blocked = await activeDb.outbox.where('status').equals('blocked').toArray()
  for (const item of blocked) {
    if (item.seq) {
      await activeDb.outbox.update(item.seq, {
        status: 'pending',
        attempts: 0,
        next_retry_at: 0,
      })
    }
  }
  await drainOutbox(activeDb, true)
}

export async function exportOfflineQueue(): Promise<string> {
  if (!activeDb) return '[]'
  const items = await activeDb.outbox.toArray()
  return JSON.stringify(items, null, 2)
}
