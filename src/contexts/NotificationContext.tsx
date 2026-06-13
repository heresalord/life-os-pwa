import React, { createContext, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { UseMutationResult } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { db } from '../db'
import { useAuth } from './AuthContext'
import { bgSync } from '../lib/localFirst'
import type { Notification } from '../db/schema'

interface NotificationContextValue {
  notifications: Notification[]
  isLoading: boolean
  unreadCount: number
  markAsRead: UseMutationResult<void, Error, string, unknown>
  markAllAsRead: UseMutationResult<void, Error, void, unknown>
  deleteNotification: UseMutationResult<void, Error, string, unknown>
  deleteAllNotifications: UseMutationResult<void, Error, void, unknown>
}

export const NotificationContext = createContext<NotificationContextValue | null>(null)

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['notifications', user?.id],
    enabled: !!user,
    staleTime: 30_000,
    queryFn: async () => {
      // 1. Fetch from Dexie (local cache)
      const local = await db.notifications.orderBy('created_at').reverse().toArray()
      
      // 2. Fetch from Supabase in background if online
      if (navigator.onLine && user) {
        bgSync(`notifications-${user.id}`, async () => {
          const { data, error } = await (supabase as any)
            .from('notifications')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(50)

          if (error) throw error
          if (data) {
            await db.notifications.bulkPut(data as Notification[])
            const idsOnServer = new Set(data.map((d: any) => d.id))
            const localNotifs = await db.notifications.toArray()
            const toDelete = localNotifs.filter(n => !idsOnServer.has(n.id)).map(n => n.id)
            if (toDelete.length > 0) {
              await db.notifications.bulkDelete(toDelete)
            }
            queryClient.setQueryData(['notifications', user.id], data)
          }
        })
      }

      return local as Notification[]
    }
  })

  // Subscribe to real-time changes
  useEffect(() => {
    if (!user) return

    const channel = supabase
      .channel(`notifications-realtime:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        async (payload) => {
          if (payload.eventType === 'INSERT') {
            const newNotif = payload.new as Notification
            await db.notifications.put(newNotif)
          } else if (payload.eventType === 'UPDATE') {
            const updatedNotif = payload.new as Notification
            await db.notifications.put(updatedNotif)
          } else if (payload.eventType === 'DELETE') {
            const deletedId = (payload.old as any).id
            if (deletedId) {
              await db.notifications.delete(deletedId)
            }
          }
          queryClient.invalidateQueries({ queryKey: ['notifications', user.id] })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user, queryClient])

  const markAsRead = useMutation({
    mutationFn: async (id: string) => {
      // 1. Always update Dexie immediately (instant UI feedback)
      const local = await db.notifications.get(id)
      if (local) {
        await db.notifications.put({ ...local, read: true })
      }

      // 2. Try to sync to Supabase; if it fails queue it for later
      if (navigator.onLine) {
        try {
          const { error } = await (supabase as any)
            .from('notifications')
            .update({ read: true })
            .eq('id', id)
          if (error) throw error
        } catch (err) {
          console.warn('[markAsRead] Supabase sync failed, queuing:', err)
          const queueItem = {
            id: crypto.randomUUID(),
            table: 'notifications',
            operation: 'update' as const,
            payload: { id, read: true },
            created_at: Date.now(),
            retries: 0,
            synced: false
          }
          await db.sync_queue.put(queueItem)
        }
      } else {
        const queueItem = {
          id: crypto.randomUUID(),
          table: 'notifications',
          operation: 'update' as const,
          payload: { id, read: true },
          created_at: Date.now(),
          retries: 0,
          synced: false
        }
        await db.sync_queue.put(queueItem)
      }
    },
    // onSettled runs whether the mutation succeeded or failed — always refresh UI
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', user?.id] })
    }
  })

  const markAllAsRead = useMutation({
    mutationFn: async () => {
      if (!user) return

      // 1. Always update all unread in Dexie immediately
      const allLocal = await db.notifications.toArray()
      const toUpdate = allLocal.filter(n => !n.read)
      for (const notif of toUpdate) {
        await db.notifications.put({ ...notif, read: true })
      }

      // 2. Try to sync to Supabase; if it fails queue each for later
      if (navigator.onLine) {
        try {
          const { error } = await (supabase as any)
            .from('notifications')
            .update({ read: true })
            .eq('user_id', user.id)
            .eq('read', false)
          if (error) throw error
        } catch (err) {
          console.warn('[markAllAsRead] Supabase sync failed, queuing:', err)
          for (const notif of toUpdate) {
            const queueItem = {
              id: crypto.randomUUID(),
              table: 'notifications',
              operation: 'update' as const,
              payload: { id: notif.id, read: true },
              created_at: Date.now(),
              retries: 0,
              synced: false
            }
            await db.sync_queue.put(queueItem)
          }
        }
      } else {
        for (const notif of toUpdate) {
          const queueItem = {
            id: crypto.randomUUID(),
            table: 'notifications',
            operation: 'update' as const,
            payload: { id: notif.id, read: true },
            created_at: Date.now(),
            retries: 0,
            synced: false
          }
          await db.sync_queue.put(queueItem)
        }
      }
    },
    // onSettled runs whether the mutation succeeded or failed — always refresh UI
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', user?.id] })
    }
  })

  const deleteNotification = useMutation({
    mutationFn: async (id: string) => {
      await db.notifications.delete(id)
      if (navigator.onLine) {
        try {
          const { error } = await (supabase as any)
            .from('notifications')
            .delete()
            .eq('id', id)
          if (error) throw error
        } catch (err) {
          console.warn('[deleteNotification] Supabase sync failed, queuing:', err)
          const queueItem = {
            id: crypto.randomUUID(),
            table: 'notifications',
            operation: 'delete' as const,
            payload: { id },
            created_at: Date.now(),
            retries: 0,
            synced: false
          }
          await db.sync_queue.put(queueItem)
        }
      } else {
        const queueItem = {
          id: crypto.randomUUID(),
          table: 'notifications',
          operation: 'delete' as const,
          payload: { id },
          created_at: Date.now(),
          retries: 0,
          synced: false
        }
        await db.sync_queue.put(queueItem)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', user?.id] })
    }
  })

  const deleteAllNotifications = useMutation({
    mutationFn: async () => {
      if (!user) return
      const allLocal = await db.notifications.toArray()
      const idsToDelete = allLocal.map(n => n.id)
      if (idsToDelete.length > 0) {
        await db.notifications.bulkDelete(idsToDelete)
      }
      if (navigator.onLine) {
        try {
          const { error } = await (supabase as any)
            .from('notifications')
            .delete()
            .eq('user_id', user.id)
          if (error) throw error
        } catch (err) {
          console.warn('[deleteAllNotifications] Supabase sync failed, queuing:', err)
          for (const id of idsToDelete) {
            const queueItem = {
              id: crypto.randomUUID(),
              table: 'notifications',
              operation: 'delete' as const,
              payload: { id },
              created_at: Date.now(),
              retries: 0,
              synced: false
            }
            await db.sync_queue.put(queueItem)
          }
        }
      } else {
        for (const id of idsToDelete) {
          const queueItem = {
            id: crypto.randomUUID(),
            table: 'notifications',
            operation: 'delete' as const,
            payload: { id },
            created_at: Date.now(),
            retries: 0,
            synced: false
          }
          await db.sync_queue.put(queueItem)
        }
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', user?.id] })
    }
  })

  const value: NotificationContextValue = {
    notifications: query.data || [],
    isLoading: query.isLoading,
    unreadCount: (query.data || []).filter(n => !n.read).length,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    deleteAllNotifications
  }

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  )
}
