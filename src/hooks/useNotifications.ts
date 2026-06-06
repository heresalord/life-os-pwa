import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { db } from '../db'
import { useAuth } from './useAuth'
import { bgSync } from '../lib/localFirst'
import type { Notification } from '../db/schema'

export function useNotifications() {
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
            .limit(50) // Keep it performant

          if (error) throw error
          if (data) {
            // Write to Dexie
            await db.notifications.bulkPut(data as Notification[])
            // Delete notifications from Dexie that are no longer present in Supabase (cleanup)
            const idsOnServer = new Set(data.map((d: any) => d.id))
            const localNotifs = await db.notifications.toArray()
            const toDelete = localNotifs.filter(n => !idsOnServer.has(n.id)).map(n => n.id)
            if (toDelete.length > 0) {
              await db.notifications.bulkDelete(toDelete)
            }
            // Invalidate React Query
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
          event: '*', // Listen to INSERT, UPDATE, DELETE
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

  // Mutation to mark a single notification as read
  const markAsRead = useMutation({
    mutationFn: async (id: string) => {
      // Optimistic local update
      const local = await db.notifications.get(id)
      if (local) {
        await db.notifications.put({ ...local, read: true })
      }
      
      if (navigator.onLine) {
        const { error } = await (supabase as any)
          .from('notifications')
          .update({ read: true })
          .eq('id', id)
        if (error) throw error
      } else {
        // Queue sync if offline
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', user?.id] })
    }
  })

  // Mutation to mark all notifications as read
  const markAllAsRead = useMutation({
    mutationFn: async () => {
      if (!user) return
      
      // Update all local unread notifications in Dexie
      const allLocal = await db.notifications.toArray()
      const toUpdate = allLocal.filter(n => !n.read)
      for (const notif of toUpdate) {
        await db.notifications.put({ ...notif, read: true })
      }

      if (navigator.onLine) {
        const { error } = await (supabase as any)
          .from('notifications')
          .update({ read: true })
          .eq('user_id', user.id)
          .eq('read', false)
        if (error) throw error
      } else {
        // Queue offline syncs for each
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', user?.id] })
    }
  })

  return {
    notifications: query.data || [],
    isLoading: query.isLoading,
    unreadCount: (query.data || []).filter(n => !n.read).length,
    markAsRead,
    markAllAsRead
  }
}
