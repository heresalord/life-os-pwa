import { useEffect } from 'react'
import { Capacitor } from '@capacitor/core'
import { PushNotifications } from '@capacitor/push-notifications'
import { supabase } from '../lib/supabase'

export function useCapacitorPush(userId: string | undefined) {
  useEffect(() => {
    // Only execute on native platforms (Android/iOS) when user is logged in
    if (!Capacitor.isNativePlatform() || !userId) return

    const registerPush = async () => {
      try {
        let permStatus = await PushNotifications.checkPermissions()

        if (permStatus.receive === 'prompt') {
          permStatus = await PushNotifications.requestPermissions()
        }

        if (permStatus.receive !== 'granted') {
          console.warn('[FCM] Push notification permission not granted')
          return
        }

        // Register with native push service (FCM / APNS)
        await PushNotifications.register()
      } catch (err) {
        console.error('[FCM] Permission request or registration failed', err)
      }
    }

    // Set up native plugin listeners
    const addListeners = async () => {
      await PushNotifications.addListener('registration', async (token) => {
        console.log('[FCM] Token generated:', token.value)
        
        try {
          const platform = Capacitor.getPlatform() // 'android' or 'ios'
          const { error } = await (supabase as any)
            .from('fcm_tokens')
            .upsert(
              {
                user_id: userId,
                token: token.value,
                device: platform,
              },
              { onConflict: 'token' }
            )
          
          if (error) {
            console.error('[FCM] Failed to sync FCM token to Supabase:', error)
          } else {
            console.log('[FCM] FCM token synced to Supabase')
          }
        } catch (dbErr) {
          console.error('[FCM] Exception saving FCM token:', dbErr)
        }
      })

      await PushNotifications.addListener('registrationError', (err) => {
        console.error('[FCM] Native registration failed:', err.error)
      })

      await PushNotifications.addListener('pushNotificationReceived', (notification) => {
        console.log('[FCM] Foreground notification received:', notification)
        // Foreground notifications are handled, and header badges will automatically update
        // due to Supabase Realtime synchronization in useNotifications.
      })

      await PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
        console.log('[FCM] Notification tapped:', notification.notification)
        const url = notification.notification.data?.url
        if (url) {
          window.location.href = url
        }
      })
    }

    addListeners()
    registerPush()

    // Cleanup listeners when component unmounts or user changes
    return () => {
      PushNotifications.removeAllListeners()
    }
  }, [userId])
}
