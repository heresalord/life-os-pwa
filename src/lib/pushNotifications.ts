import { supabase } from './supabase'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0))).buffer as ArrayBuffer
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

export type PushResult =
  | { ok: true }
  | { ok: false; reason: 'no_vapid_key' | 'no_sw_support' | 'permission_denied' | 'sw_failed' | 'unknown' }

export async function subscribeToPush(userId: string): Promise<PushResult> {
  if (!VAPID_PUBLIC_KEY) {
    return { ok: false, reason: 'no_vapid_key' }
  }
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return { ok: false, reason: 'no_sw_support' }
  }

  try {
    const reg = await registerPushSW()
    if (!reg) return { ok: false, reason: 'sw_failed' }

    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return { ok: false, reason: 'permission_denied' }

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

    return { ok: true }
  } catch (e) {
    console.warn('[Push] Subscribe failed', e)
    return { ok: false, reason: 'unknown' }
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

// True only when the full push stack is available AND the VAPID key is configured
export const pushSupported =
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  'PushManager' in window &&
  'Notification' in window &&
  !!VAPID_PUBLIC_KEY
