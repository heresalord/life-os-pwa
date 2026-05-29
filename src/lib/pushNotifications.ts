/**
 * Push notification client helpers.
 * The service worker (push-sw.js), Edge Function (send-push), and cron jobs
 * are already in place. This module handles:
 *  1. Registering the push service worker
 *  2. Requesting permission + subscribing
 *  3. Saving the subscription to Supabase push_subscriptions
 *  4. Unsubscribing / removing from DB
 */
import { supabase } from './supabase'

// Set in .env.local as VITE_VAPID_PUBLIC_KEY
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const arr = Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))
  return arr.buffer as ArrayBuffer
}

export async function registerPushSW(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null
  try {
    const reg = await navigator.serviceWorker.register('/push-sw.js', { scope: '/' })
    return reg
  } catch (e) {
    console.warn('[Push] SW registration failed', e)
    return null
  }
}

export async function subscribeToPush(userId: string): Promise<boolean> {
  if (!VAPID_PUBLIC_KEY) {
    console.warn('[Push] VITE_VAPID_PUBLIC_KEY not set')
    return false
  }
  try {
    const reg = await registerPushSW()
    if (!reg) return false

    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return false

    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    })

    const subJson = sub.toJSON()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sbAny = supabase as any
    await sbAny.from('push_subscriptions').upsert({
      user_id: userId,
      endpoint: subJson.endpoint,
      keys: subJson.keys,
      user_agent: navigator.userAgent,
    }, { onConflict: 'endpoint' })

    return true
  } catch (e) {
    console.warn('[Push] Subscribe failed', e)
    return false
  }
}

export async function unsubscribeFromPush(userId: string): Promise<void> {
  try {
    const reg = await navigator.serviceWorker.getRegistration('/push-sw.js')
    const sub = await reg?.pushManager.getSubscription()
    if (sub) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sbAny = supabase as any
      await sbAny.from('push_subscriptions')
        .delete()
        .eq('user_id', userId)
        .eq('endpoint', sub.endpoint)
      await sub.unsubscribe()
    }
  } catch (e) {
    console.warn('[Push] Unsubscribe failed', e)
  }
}

export async function isPushSubscribed(): Promise<boolean> {
  try {
    const reg = await navigator.serviceWorker.getRegistration('/push-sw.js')
    const sub = await reg?.pushManager.getSubscription()
    return !!sub
  } catch {
    return false
  }
}

export const pushSupported =
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  'PushManager' in window &&
  'Notification' in window
