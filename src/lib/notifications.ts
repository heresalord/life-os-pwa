import { supabase } from './supabase'
import type { NotificationPreference, Device } from '../db/schema'

export interface EventCatalogItem {
  type: string
  label: string
  description: string
  category: 'social' | 'collaboration' | 'productivity' | 'finance'
  defaultInApp: boolean
  defaultEmail: boolean
  defaultPush: boolean
}

export const EVENT_CATALOG: Record<string, EventCatalogItem> = {
  'project.member_joined': {
    type: 'project.member_joined',
    label: 'Project Member Joined',
    description: 'When someone joins or accepts your project invite',
    category: 'collaboration',
    defaultInApp: true,
    defaultEmail: false,
    defaultPush: true
  },
  'share.invited': {
    type: 'share.invited',
    label: 'Invitation Received',
    description: 'When you are invited to collaborate on a project, task, or note',
    category: 'collaboration',
    defaultInApp: true,
    defaultEmail: true,
    defaultPush: true
  },
  'friend.request_received': {
    type: 'friend.request_received',
    label: 'Friend Request',
    description: 'When someone sends you a friend connection request',
    category: 'social',
    defaultInApp: true,
    defaultEmail: true,
    defaultPush: true
  },
  'friend.request_accepted': {
    type: 'friend.request_accepted',
    label: 'Friend Request Accepted',
    description: 'When your friend connection request is accepted',
    category: 'social',
    defaultInApp: true,
    defaultEmail: false,
    defaultPush: false
  },
  'note.shared': {
    type: 'note.shared',
    label: 'Note Shared',
    description: 'When someone shares a note with you',
    category: 'collaboration',
    defaultInApp: true,
    defaultEmail: false,
    defaultPush: false
  },
  'book.recommended': {
    type: 'book.recommended',
    label: 'Book Recommended',
    description: 'When a friend recommends a book to read',
    category: 'social',
    defaultInApp: true,
    defaultEmail: false,
    defaultPush: false
  },
  'finance.budget_warning': {
    type: 'finance.budget_warning',
    label: 'Budget Warning',
    description: 'When your spending reaches 80% or more of your budget limit',
    category: 'finance',
    defaultInApp: true,
    defaultEmail: true,
    defaultPush: true
  },
  'task.reminder': {
    type: 'task.reminder',
    label: 'Task Reminder',
    description: 'Reminders for scheduled, due, or overdue tasks',
    category: 'productivity',
    defaultInApp: true,
    defaultEmail: false,
    defaultPush: true
  }
}

/**
 * Returns merged preferences for a user: database overrides merged with catalog defaults.
 */
export async function getMergedNotificationPreferences(
  userId: string
): Promise<Record<string, NotificationPreference>> {
  const merged: Record<string, NotificationPreference> = {}

  // 1. Initialize with defaults from catalog
  for (const [eventType, item] of Object.entries(EVENT_CATALOG)) {
    merged[eventType] = {
      user_id: userId,
      event_type: eventType,
      in_app: item.defaultInApp,
      email: item.defaultEmail,
      push: item.defaultPush
    }
  }

  // 2. Query user preferences table from Supabase
  try {
    const { data, error } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', userId)

    if (error) {
      console.warn('[notifications] Failed to load preferences:', error)
      return merged
    }

    if (data) {
      for (const row of data) {
        if (merged[row.event_type]) {
          merged[row.event_type] = {
            ...merged[row.event_type],
            in_app: row.in_app,
            email: row.email,
            push: row.push,
            updated_at: row.updated_at
          }
        } else {
          merged[row.event_type] = row as NotificationPreference
        }
      }
    }
  } catch (err) {
    console.warn('[notifications] Error fetching preferences:', err)
  }

  return merged
}

/**
 * Updates a specific channel preference for an event type.
 */
export async function updateNotificationPreference(
  userId: string,
  eventType: string,
  channel: 'in_app' | 'email' | 'push',
  enabled: boolean
): Promise<{ ok: boolean; error?: string }> {
  try {
    const catalogItem = EVENT_CATALOG[eventType]
    const defaultInApp = catalogItem?.defaultInApp ?? true
    const defaultEmail = catalogItem?.defaultEmail ?? false
    const defaultPush = catalogItem?.defaultPush ?? false

    // Fetch existing or insert
    const { data: existing } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', userId)
      .eq('event_type', eventType)
      .maybeSingle()

    const updatedRow = {
      user_id: userId,
      event_type: eventType,
      in_app: channel === 'in_app' ? enabled : (existing?.in_app ?? defaultInApp),
      email: channel === 'email' ? enabled : (existing?.email ?? defaultEmail),
      push: channel === 'push' ? enabled : (existing?.push ?? defaultPush),
      updated_at: new Date().toISOString()
    }

    const { error } = await supabase
      .from('notification_preferences')
      .upsert(updatedRow, { onConflict: 'user_id,event_type' })

    if (error) throw error
    return { ok: true }
  } catch (err: any) {
    console.error('[notifications] Failed to update preference:', err)
    return { ok: false, error: err.message }
  }
}

/**
 * Registers or updates a device push token for a user.
 */
export async function registerDeviceToken(
  userId: string,
  token: string,
  platform: 'ios' | 'android' | 'web' | 'pwa'
): Promise<Device | null> {
  try {
    const { data, error } = await supabase
      .from('devices')
      .upsert(
        {
          user_id: userId,
          platform,
          push_token: token,
          last_seen_at: new Date().toISOString()
        },
        { onConflict: 'user_id,push_token' }
      )
      .select()
      .single()

    if (error) {
      console.warn('[devices] Error registering device token:', error)
      return null
    }

    return data as Device
  } catch (err) {
    console.warn('[devices] Failed to register device:', err)
    return null
  }
}

/**
 * Removes a device token on sign out or push opt-out.
 */
export async function unregisterDeviceToken(
  userId: string,
  token: string
): Promise<void> {
  try {
    await supabase
      .from('devices')
      .delete()
      .eq('user_id', userId)
      .eq('push_token', token)
  } catch (err) {
    console.warn('[devices] Failed to unregister device token:', err)
  }
}

/**
 * Dispatches a domain event via database notify function.
 */
export async function sendNotification(
  userId: string,
  type: string,
  payload: {
    title: string
    body: string
    action_url?: string
    [key: string]: any
  }
): Promise<{ ok: boolean; notificationId?: string; error?: string }> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.rpc as any)('notify', {
      p_user_id: userId,
      p_type: type,
      p_payload: payload
    })

    if (error) throw error
    return { ok: true, notificationId: data }
  } catch (err: any) {
    console.error('[notifications] sendNotification failed:', err)
    return { ok: false, error: err.message }
  }
}
