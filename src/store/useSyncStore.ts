import { create } from 'zustand'

interface SyncState {
  isOnline: boolean
  isSyncing: boolean
  pendingCount: number
  setOnlineStatus: (status: boolean) => void
  setIsSyncing: (status: boolean) => void
  setPendingCount: (count: number) => void
}

export const useSyncStore = create<SyncState>((set) => ({
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  isSyncing: false,
  pendingCount: 0,
  setOnlineStatus: (status) => set({ isOnline: status }),
  setIsSyncing: (status) => set({ isSyncing: status }),
  setPendingCount: (count) => set({ pendingCount: count })
}))
