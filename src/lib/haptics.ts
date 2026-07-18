/**
 * haptics.ts — Phase 6.8
 *
 * Thin wrapper over Capacitor Haptics. Falls back to a no-op on web/desktop
 * so it's safe to call everywhere without platform guards at the call site.
 *
 * Usage:
 *   haptic()              → light impact (default, nav taps, minor actions)
 *   haptic('medium')      → medium impact (task completion)
 *   haptic('success')     → notification success (goal completion, form submit)
 *   haptic('warning')     → notification warning
 *   haptic('error')       → notification error
 */

import { Capacitor } from '@capacitor/core'

type ImpactStrength = 'light' | 'medium' | 'heavy'
type NotificationStyle = 'success' | 'warning' | 'error'
type HapticStyle = ImpactStrength | NotificationStyle

let _hapticsPlugin: {
  impact: (opts: { style: string }) => Promise<void>
  notification: (opts: { type: string }) => Promise<void>
} | null = null

async function getPlugin() {
  if (_hapticsPlugin) return _hapticsPlugin
  if (!Capacitor.isNativePlatform()) return null
  try {
    // Dynamic import so it doesn't bloat web bundles
    const { Haptics } = await import('@capacitor/haptics')
    _hapticsPlugin = Haptics as unknown as typeof _hapticsPlugin
    return _hapticsPlugin
  } catch {
    return null
  }
}

const NOTIFICATION_STYLES = new Set<HapticStyle>(['success', 'warning', 'error'])

export async function haptic(style: HapticStyle = 'light'): Promise<void> {
  const plugin = await getPlugin()
  if (!plugin) return

  if (NOTIFICATION_STYLES.has(style)) {
    await plugin.notification({ type: style.toUpperCase() })
  } else {
    await plugin.impact({ style: style.toUpperCase() })
  }
}

/** Convenience shorthands */
export const hapticLight   = () => haptic('light')
export const hapticMedium  = () => haptic('medium')
export const hapticSuccess = () => haptic('success')
