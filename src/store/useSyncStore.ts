import { create } from 'zustand'

interface SyncCounts {
  pendingCount: number
  blockedCount: number
  lastError: string | null
}

interface SyncState {
  isOnline: boolean
  isSyncing: boolean
  pendingCount: number
  blockedCount: number
  lastError: string | null
  setOnlineStatus: (status: boolean) => void
  setIsSyncing: (status: boolean) => void
  setPendingCount: (count: number) => void
  setSyncCounts: (counts: SyncCounts) => void
}

export const useSyncStore = create<SyncState>((set) => ({
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  isSyncing: false,
  pendingCount: 0,
  blockedCount: 0,
  lastError: null,
  setOnlineStatus: (status) => set({ isOnline: status }),
  setIsSyncing: (status) => set({ isSyncing: status }),
  setPendingCount: (count) => set({ pendingCount: count }),
  setSyncCounts: ({ pendingCount, blockedCount, lastError }) =>
    set({ pendingCount, blockedCount, lastError }),
}))
