import { useState, useEffect } from 'react'

type Platform = 'android' | 'ios' | 'desktop' | 'other'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function getPlatform(): Platform {
  const ua = navigator.userAgent
  if (/android/i.test(ua)) return 'android'
  if (/ipad|iphone|ipod/i.test(ua)) return 'ios'
  if (window.matchMedia('(display-mode: browser)').matches && !('ontouchstart' in window)) return 'desktop'
  return 'other'
}

function isAlreadyInstalled(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
}

const DISMISSED_KEY = 'lifeos-install-dismissed'

export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [platform] = useState<Platform>(getPlatform)
  const [installed, setInstalled] = useState(isAlreadyInstalled)
  const [dismissed, setDismissed] = useState(() => {
    const ts = localStorage.getItem(DISMISSED_KEY)
    if (!ts) return false
    // Re-show after 7 days
    return Date.now() - parseInt(ts) < 7 * 24 * 60 * 60 * 1000
  })

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)

    const installedHandler = () => setInstalled(true)
    window.addEventListener('appinstalled', installedHandler)

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
      window.removeEventListener('appinstalled', installedHandler)
    }
  }, [])

  const triggerInstall = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === 'accepted') setInstalled(true)
      setDeferredPrompt(null)
    }
  }

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, Date.now().toString())
    setDismissed(true)
  }

  const shouldShow = !installed && !dismissed && (
    platform === 'ios' ||
    platform === 'android' ||
    (platform === 'desktop' && !!deferredPrompt)
  )

  return { platform, shouldShow, triggerInstall, dismiss, deferredPrompt }
}
