/**
 * Haptic feedback utility.
 * Uses the Vibration API on web/Android; will be replaced with
 * Capacitor Haptics when the native shell is added.
 */
export type HapticStyle = 'light' | 'medium' | 'heavy' | 'success' | 'error'

const PATTERNS: Record<HapticStyle, number | number[]> = {
  light:   10,
  medium:  25,
  heavy:   50,
  success: [10, 60, 10],
  error:   [30, 50, 30, 50, 30],
}

export function haptic(style: HapticStyle = 'light') {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(PATTERNS[style])
    }
  } catch {
    // Silently ignore — vibration is an enhancement, not a requirement
  }
}
