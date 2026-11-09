/**
 * sync.ts — Phase 0.5 sync engine with safety hotfixes
 *
 * Hotfixes implemented:
 * 1. Single-flight drain: module-level drainPromise prevents overlapping drains.
 * 2. Never overwrite the queue: removes only items that succeeded; keeps mid-drain additions.
 * 3. Preserve order: appends to queue instead of pushing directly if older writes for the same row are queued.
 * 4. Never drop: after MAX_RETRIES, marks item 'blocked' with last error and exponential backoff.
 * 5. Make failures visible: tracks pending, blocked, and lastError in useSyncStore.
 */

import { supabase } from './supabase'
import { useSyncStore } from '../store/useSyncStore'
import { Capacitor } from '@capacitor/core'
import { App as CapacitorApp } from '@capacitor/app'
import { queryClient } from './queryClient'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface OfflineQueueItem {
  id:            string
  table:         string
  op:            'insert' | 'update' | 'delete'
  payload:       Record<string, unknown>
  ts:            number
  retries:       number
  status?:       'pending' | 'blocked'
  last_error?:   string
  next_retry_at?: number
}

const QUEUE_KEY = 'lifeos-offline-queue'
const MAX_RETRIES = 5

// Exponential backoff curve: 5s, 30s, 2m, 10m
function getBackoffMs(retries: number): number {
  if (retries <= 1) return 5_000
  if (retries === 2) return 30_000
  if (retries === 3) return 120_000
  return 600_000
}

// ── Internal helpers ──────────────────────────────────────────────────────────

export function readQueue(): OfflineQueueItem[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]')
  } catch {
    return []
  }
}

function writeQueue(q: OfflineQueueItem[]): void {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(q))
}

function syncStoreWithQueue(q = readQueue()): void {
  const pending = q.filter(i => i.status !== 'blocked').length
  const blocked = q.filter(i => i.status === 'blocked').length
  const lastErr = q.find(i => i.last_error)?.last_error ?? null
  useSyncStore.getState().setSyncCounts({
    pendingCount: pending,
    blockedCount: blocked,
    lastError: lastErr,
  })
}

function addToQueue(
  table: string,
  op: OfflineQueueItem['op'],
  payload: Record<string, unknown>,
  lastError?: string
): void {
  const q = readQueue()
  q.push({
    id: crypto.randomUUID(),
    table,
    op,
    payload,
    ts: Date.now(),
    retries: 0,
    status: 'pending',
    last_error: lastError,
    next_retry_at: 0,
  })
  writeQueue(q)
  syncStoreWithQueue(q)
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

export function getQueuedItemsForTable(table: string): OfflineQueueItem[] {
  return readQueue().filter(i => i.table === table)
}

export function hasPendingSync(): boolean {
  return readQueue().some(i => i.status !== 'blocked')
}

export function hasBlockedSync(): boolean {
  return readQueue().some(i => i.status === 'blocked')
}

// ── Public: single-flight drain ───────────────────────────────────────────────

let drainPromise: Promise<void> | null = null

export async function drainOfflineQueue(force = false): Promise<void> {
  if (drainPromise) return drainPromise

  drainPromise = (async () => {
    try {
      if (!navigator.onLine) {
        syncStoreWithQueue()
        return
      }

      const q = readQueue()
      if (q.length === 0) {
        syncStoreWithQueue(q)
        return
      }

      useSyncStore.getState().setIsSyncing(true)

      const now = Date.now()
      const succeededIds = new Set<string>()
      const failedUpdates = new Map<string, Partial<OfflineQueueItem>>()

      for (const item of q) {
        // Skip blocked items unless manually forced (e.g. from Diagnostics "Retry now")
        if (item.status === 'blocked' && !force) continue
        // Skip items in exponential backoff window unless forced
        if (item.next_retry_at && item.next_retry_at > now && !force) continue

        try {
          await pushToSupabase(item)
          succeededIds.add(item.id)
        } catch (err: any) {
          const errMsg = err?.message || String(err)
          console.warn(`[sync] Failed to sync ${item.table} (attempt ${item.retries + 1}):`, errMsg)
          const newRetries = item.retries + 1
          const isBlocked = newRetries >= MAX_RETRIES
          const nextRetryAt = Date.now() + getBackoffMs(newRetries)

          failedUpdates.set(item.id, {
            retries: newRetries,
            status: isBlocked ? 'blocked' : 'pending',
            last_error: errMsg,
            next_retry_at: nextRetryAt,
          })
        }
      }

      // Re-read queue from storage so items enqueued mid-drain are NEVER lost!
      const latestQueue = readQueue()
      const newQueue = latestQueue
        .filter(item => !succeededIds.has(item.id))
        .map(item => {
          const update = failedUpdates.get(item.id)
          return update ? { ...item, ...update } : item
        })

      writeQueue(newQueue)
      syncStoreWithQueue(newQueue)
    } finally {
      useSyncStore.getState().setIsSyncing(false)
      drainPromise = null
    }
  })()

  return drainPromise
}

// ── Diagnostics actions ──────────────────────────────────────────────────────

/**
 * Resets blocked items and triggers an immediate drain.
 */
export async function retryBlockedItems(): Promise<void> {
  const q = readQueue()
  const resetQueue = q.map(i => ({
    ...i,
    status: 'pending' as const,
    retries: 0,
    next_retry_at: 0,
  }))
  writeQueue(resetQueue)
  await drainOfflineQueue(true)
}

/**
 * Export offline queue as JSON for debugging or backup.
 */
export function exportOfflineQueue(): void {
  const q = readQueue()
  const blob = new Blob([JSON.stringify(q, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `kairo_offline_queue_${new Date().toISOString().split('T')[0]}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ── Public: write function with write-order preservation ─────────────────────

export async function syncToSupabase(
  table: string,
  op:    OfflineQueueItem['op'],
  payload: Record<string, unknown>
): Promise<void> {
  if (!navigator.onLine) {
    addToQueue(table, op, payload)
    return
  }

  // Preserve order: if an older write for the same row is already queued,
  // append this write to the queue and drain instead of pushing directly.
  const rowId = payload?.id
  const currentQueue = readQueue()
  const hasOlder = rowId && currentQueue.some(
    item => item.table === table && item.payload?.id === rowId
  )

  if (hasOlder) {
    addToQueue(table, op, payload)
    void drainOfflineQueue()
    return
  }

  try {
    await pushToSupabase({
      id: crypto.randomUUID(),
      table,
      op,
      payload,
      ts: Date.now(),
      retries: 0,
    })
  } catch (err: any) {
    const errMsg = err?.message || String(err)
    console.warn(`[sync] Direct push failed for ${table}, queuing:`, errMsg)
    addToQueue(table, op, payload, errMsg)
  }
}

// ── Public: engine lifecycle ────────────────────────────────────────────────

let intervalId: ReturnType<typeof setInterval> | null = null
let onOnlineHandler:  (() => void) | null = null
let onOfflineHandler: (() => void) | null = null
let onFocusHandler:   (() => void) | null = null
let appStateHandle:   { remove: () => void } | null = null

export function startSyncEngine(): void {
  if (intervalId) return

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
  onFocusHandler = () => {
    if (navigator.onLine) {
      queryClient.invalidateQueries({ queryKey: ['notes'] })
      queryClient.invalidateQueries({ queryKey: ['inbox'] })
      void drainOfflineQueue()
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
        void drainOfflineQueue()
      }
    }).then(handle => {
      appStateHandle = handle
    }).catch(() => { /* ignore */ })
  }

  syncStoreWithQueue()
}

export function stopSyncEngine(): void {
  if (intervalId) { clearInterval(intervalId); intervalId = null }
  if (onOnlineHandler)  { window.removeEventListener('online',  onOnlineHandler);  onOnlineHandler  = null }
  if (onOfflineHandler) { window.removeEventListener('offline', onOfflineHandler); onOfflineHandler = null }
  if (onFocusHandler)   { window.removeEventListener('focus',    onFocusHandler);   onFocusHandler   = null }
  if (appStateHandle)   { appStateHandle.remove(); appStateHandle = null }
}

export async function processSyncQueue(): Promise<void> {
  await drainOfflineQueue()
}
