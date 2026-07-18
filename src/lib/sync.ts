/**
 * sync.ts — Phase 3 simplified sync engine
 *
 * Previous model: write to Dexie → add to sync_queue Dexie table →
 *   processSyncQueue polls every 30s and pushes to Supabase.
 *
 * New model: write to Dexie (local-first) → push to Supabase immediately
 *   when online, OR queue to localStorage when offline →
 *   drainOfflineQueue() runs on reconnect and on foreground.
 *
 * API surface kept intentionally stable so callers (DbContext, SyncStatusDot)
 * need no changes:
 *   startSyncEngine(db?)  — sets up listeners (db param ignored, kept for compat)
 *   stopSyncEngine()      — tears down listeners
 *   processSyncQueue(db?) — alias for drainOfflineQueue (db param ignored)
 *
 * The only remaining `supabase as any` cast in this file is required because
 * syncWrite receives table names as runtime strings, which the TypeScript
 * generic client cannot resolve statically. This is intentional and isolated
 * to this one file. All other callers use the fully-typed supabase client.
 */

import { supabase } from './supabase'
import { useSyncStore } from '../store/useSyncStore'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface OfflineQueueItem {
  id:      string
  table:   string
  op:      'insert' | 'update' | 'delete'
  payload: Record<string, unknown>
  ts:      number
  retries: number
}

const QUEUE_KEY = 'lifeos-offline-queue'
const MAX_RETRIES = 5

// ── Internal helpers ──────────────────────────────────────────────────────────

function readQueue(): OfflineQueueItem[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]')
  } catch {
    return []
  }
}

function writeQueue(q: OfflineQueueItem[]): void {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(q))
}

function addToQueue(table: string, op: OfflineQueueItem['op'], payload: Record<string, unknown>): void {
  const q = readQueue()
  q.push({ id: crypto.randomUUID(), table, op, payload, ts: Date.now(), retries: 0 })
  writeQueue(q)
  useSyncStore.getState().setPendingCount(q.length)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supa = supabase as any

async function pushToSupabase(item: OfflineQueueItem): Promise<void> {
  if (item.op === 'delete') {
    const { error } = await supa.from(item.table).delete().eq('id', item.payload.id)
    if (error) throw error
  } else {
    // 'insert' and 'update' both use upsert so retries are idempotent
    const { error } = await supa.from(item.table).upsert(item.payload, { onConflict: 'id' })
    if (error) throw error
  }
}

// ── Public: offline queue helpers (used by localFirst.ts) ────────────────────

/**
 * Returns all queued items for a given table — used by reconcileWithQueue
 * in localFirst.ts to avoid overwriting locally-pending data with stale
 * server responses during a background sync.
 */
export function getQueuedItemsForTable(table: string): OfflineQueueItem[] {
  return readQueue().filter(i => i.table === table)
}

/** True if there are any items in the offline queue. */
export function hasPendingSync(): boolean {
  return readQueue().length > 0
}

// ── Public: drain the queue ───────────────────────────────────────────────────

export async function drainOfflineQueue(): Promise<void> {
  if (!navigator.onLine) return

  const q = readQueue()
  if (q.length === 0) return

  useSyncStore.getState().setIsSyncing(true)

  const failed: OfflineQueueItem[] = []

  for (const item of q) {
    if (item.retries >= MAX_RETRIES) {
      console.warn(`[sync] Dropping item after ${MAX_RETRIES} retries:`, item.table, item.id)
      continue
    }
    try {
      await pushToSupabase(item)
    } catch (err) {
      console.warn(`[sync] Failed to sync ${item.table} (attempt ${item.retries + 1}):`, err)
      failed.push({ ...item, retries: item.retries + 1 })
    }
  }

  writeQueue(failed)
  useSyncStore.getState().setPendingCount(failed.length)
  useSyncStore.getState().setIsSyncing(false)
}

// ── Public: the main write function used by syncQueue.ts ─────────────────────

/**
 * Push a write to Supabase immediately (online) or queue it (offline).
 *
 * The local write (Dexie) has ALREADY happened before this is called —
 * syncQueue.enqueueSync is responsible for the Dexie write. This function
 * only handles the Supabase push or offline queuing.
 */
export async function syncToSupabase(
  table: string,
  op:    OfflineQueueItem['op'],
  payload: Record<string, unknown>
): Promise<void> {
  if (!navigator.onLine) {
    addToQueue(table, op, payload)
    return
  }

  try {
    await pushToSupabase({ id: '', table, op, payload, ts: Date.now(), retries: 0 })
  } catch (err) {
    console.warn(`[sync] Direct push failed for ${table}, queuing:`, err)
    addToQueue(table, op, payload)
  }
}

// ── Public: engine lifecycle (API-compatible with old sync.ts) ───────────────

let intervalId: ReturnType<typeof setInterval> | null = null
let onOnlineHandler:  (() => void) | null = null
let onOfflineHandler: (() => void) | null = null

/**
 * startSyncEngine — sets up the online/offline listeners and a 60s drain
 * interval. The `db` parameter is accepted for backward compatibility but
 * is no longer used — the new engine reads/writes from localStorage.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function startSyncEngine(_db?: unknown): void {
  if (intervalId) return // already running

  // Drain immediately in case there are queued items from a previous session
  void drainOfflineQueue()

  // Drain every 60 s while online
  intervalId = setInterval(() => {
    if (navigator.onLine) void drainOfflineQueue()
  }, 60_000)

  onOnlineHandler = () => {
    useSyncStore.getState().setOnlineStatus(true)
    void drainOfflineQueue()
  }
  onOfflineHandler = () => {
    useSyncStore.getState().setOnlineStatus(false)
  }

  window.addEventListener('online',  onOnlineHandler)
  window.addEventListener('offline', onOfflineHandler)

  // Update pending count from localStorage on start
  useSyncStore.getState().setPendingCount(readQueue().length)
}

export function stopSyncEngine(): void {
  if (intervalId) { clearInterval(intervalId); intervalId = null }
  if (onOnlineHandler)  { window.removeEventListener('online',  onOnlineHandler);  onOnlineHandler  = null }
  if (onOfflineHandler) { window.removeEventListener('offline', onOfflineHandler); onOfflineHandler = null }
}

/**
 * processSyncQueue — alias for drainOfflineQueue.
 * Kept for backward compatibility with SyncStatusDot which calls it directly.
 * The `db` parameter is accepted but ignored.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function processSyncQueue(_db?: unknown): Promise<void> {
  await drainOfflineQueue()
}
