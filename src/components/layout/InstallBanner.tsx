import { useState } from 'react'
import { X, Download, Share, MoreVertical } from 'lucide-react'
import { useInstallPrompt } from '../../hooks/useInstallPrompt'

export function InstallBanner() {
  const { platform, shouldShow, triggerInstall, dismiss, deferredPrompt } = useInstallPrompt()
  const [showIOSSteps, setShowIOSSteps] = useState(false)

  if (!shouldShow) return null

  // iOS — no programmatic install, show step-by-step sheet
  if (platform === 'ios') {
    return (
      <>
        {/* Trigger button — bottom of screen above nav */}
        {!showIOSSteps && (
          <div className="fixed bottom-20 left-4 right-4 z-40 flex items-center gap-3 bg-surface border border-accent/30 rounded-2xl px-4 py-3 shadow-xl shadow-black/40"
            style={{ marginBottom: 'env(safe-area-inset-bottom)' }}>
            <div className="w-9 h-9 rounded-xl bg-accent/15 flex items-center justify-center flex-shrink-0">
              <Download size={18} className="text-accent" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text">Install Life OS</p>
              <p className="text-xs text-text-muted">Add to your home screen</p>
            </div>
            <button
              onClick={() => setShowIOSSteps(true)}
              className="px-3 py-1.5 bg-accent text-bg text-xs font-medium rounded-lg hover:bg-accent-dim transition-colors"
            >
              How
            </button>
            <button onClick={dismiss} className="text-text-muted hover:text-text ml-1">
              <X size={16} />
            </button>
          </div>
        )}

        {/* iOS instruction sheet */}
        {showIOSSteps && (
          <>
            <div className="fixed inset-0 z-50 bg-bg/80 backdrop-blur-sm" onClick={() => setShowIOSSteps(false)} />
            <div className="fixed bottom-0 left-0 right-0 z-50 bg-surface border-t border-border rounded-t-2xl p-6 shadow-2xl"
              style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}>
              <div className="w-10 h-1 rounded-full bg-border mx-auto mb-5" />
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-base font-medium text-text">Add to Home Screen</h3>
                <button onClick={() => setShowIOSSteps(false)} className="text-text-muted hover:text-text">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4">
                <Step number={1} icon={<Share size={18} className="text-info" />}>
                  Tap the <span className="text-info font-medium">Share</span> button at the bottom of Safari
                  <span className="ml-1 inline-flex items-center justify-center w-6 h-6 bg-info/15 rounded text-info">
                    <Share size={12} />
                  </span>
                </Step>
                <Step number={2} icon={<MoreVertical size={18} className="text-info" />}>
                  Scroll down and tap <span className="text-info font-medium">"Add to Home Screen"</span>
                </Step>
                <Step number={3} icon={<Download size={18} className="text-info" />}>
                  Tap <span className="text-info font-medium">"Add"</span> in the top right — done!
                </Step>
              </div>

              <p className="text-xs text-text-muted mt-5 text-center">
                Must use <span className="text-text">Safari</span> — Chrome on iOS doesn't support PWA install.
              </p>

              <button
                onClick={dismiss}
                className="w-full mt-4 py-3 text-sm text-text-muted hover:text-text transition-colors"
              >
                Dismiss
              </button>
            </div>
          </>
        )}
      </>
    )
  }

  // Android / Desktop — native prompt available
  if (deferredPrompt) {
    return (
      <div className="fixed bottom-20 left-4 right-4 z-40 flex items-center gap-3 bg-surface border border-accent/30 rounded-2xl px-4 py-3 shadow-xl shadow-black/40"
        style={{ marginBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="w-9 h-9 rounded-xl bg-accent/15 flex items-center justify-center flex-shrink-0">
          <Download size={18} className="text-accent" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-text">Install Life OS</p>
          <p className="text-xs text-text-muted">Works offline, feels native</p>
        </div>
        <button
          onClick={triggerInstall}
          className="px-3 py-1.5 bg-accent text-bg text-xs font-medium rounded-lg hover:bg-accent-dim transition-colors flex-shrink-0"
        >
          Install
        </button>
        <button onClick={dismiss} className="text-text-muted hover:text-text ml-1">
          <X size={16} />
        </button>
      </div>
    )
  }

  return null
}

function Step({ number, icon, children }: { number: number, icon: React.ReactNode, children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-6 h-6 rounded-full bg-info/15 text-info text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
        {number}
      </div>
      <div className="flex items-start gap-2 flex-1">
        <span className="flex-shrink-0 mt-0.5">{icon}</span>
        <p className="text-sm text-text-secondary leading-relaxed">{children}</p>
      </div>
    </div>
  )
}
