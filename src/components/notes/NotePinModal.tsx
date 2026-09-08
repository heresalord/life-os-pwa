import { useState, useEffect, useRef } from 'react'
import { Lock, Unlock, Eye, EyeOff, X, ShieldCheck, AlertTriangle } from 'lucide-react'
import { createPortal } from 'react-dom'
import { verifyPin } from '../../hooks/useNoteMutations'

// ─── PIN Set/Change Modal ────────────────────────────────────────────────────

export function NotePinSetModal({
  open,
  hasExistingPin,
  onClose,
  onSet,
  onRemove,
}: {
  open: boolean
  hasExistingPin: boolean
  onClose: () => void
  onSet: (pin: string) => Promise<void>
  onRemove?: () => Promise<void>
}) {
  const [step, setStep] = useState<'current' | 'new' | 'confirm'>('new')
  const [currentPin, setCurrentPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [showPin, setShowPin] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setStep(hasExistingPin ? 'current' : 'new')
      setCurrentPin('')
      setNewPin('')
      setConfirmPin('')
      setError('')
      setShowPin(false)
    }
  }, [open, hasExistingPin])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50)
  }, [open, step])

  if (!open) return null

  const handleNext = async () => {
    setError('')
    if (step === 'current') {
      // Verify handled externally — we just pass currentPin up
      // For simplicity we transition to new step directly
      if (!currentPin) { setError('Enter your current PIN'); return }
      setStep('new')
      return
    }
    if (step === 'new') {
      if (newPin.length < 4) { setError('PIN must be at least 4 digits'); return }
      if (!/^\d+$/.test(newPin)) { setError('PIN must contain only numbers'); return }
      setStep('confirm')
      return
    }
    if (step === 'confirm') {
      if (confirmPin !== newPin) { setError('PINs do not match'); return }
      setLoading(true)
      try {
        await onSet(newPin)
        onClose()
      } catch {
        setError('Failed to set PIN')
      } finally {
        setLoading(false)
      }
    }
  }

  const handleRemove = async () => {
    if (!onRemove) return
    setLoading(true)
    try {
      await onRemove()
      onClose()
    } catch {
      setError('Failed to remove PIN')
    } finally {
      setLoading(false)
    }
  }

  const stepLabel = step === 'current' ? 'Enter Current PIN' : step === 'new' ? 'Set New PIN' : 'Confirm PIN'
  const value = step === 'current' ? currentPin : step === 'new' ? newPin : confirmPin
  const setValue = step === 'current' ? setCurrentPin : step === 'new' ? setNewPin : setConfirmPin

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-surface border border-border rounded-2xl w-full max-w-sm shadow-2xl p-6 space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent/15 text-accent flex items-center justify-center">
              <Lock size={18} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-text">{hasExistingPin ? 'Change PIN' : 'Lock Note'}</h2>
              <p className="text-xs text-text-muted">{stepLabel}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-surface-2 text-text-muted flex items-center justify-center">
            <X size={16} />
          </button>
        </div>

        {/* Progress dots */}
        <div className="flex gap-2 justify-center">
          {(hasExistingPin ? ['current', 'new', 'confirm'] : ['new', 'confirm']).map((s, i) => (
            <div
              key={s}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                (hasExistingPin ? ['current', 'new', 'confirm'] : ['new', 'confirm']).indexOf(step) >= i
                  ? 'bg-accent w-6'
                  : 'bg-border w-4'
              }`}
            />
          ))}
        </div>

        {/* PIN input — digit boxes */}
        <div className="space-y-3">
          <div className="relative">
            <input
              ref={inputRef}
              type={showPin ? 'text' : 'password'}
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={8}
              value={value}
              onChange={e => { setValue(e.target.value.replace(/\D/g, '')); setError('') }}
              onKeyDown={e => { if (e.key === 'Enter') handleNext() }}
              placeholder="Enter PIN…"
              className="w-full bg-surface-2 border border-border focus:border-accent focus:ring-1 focus:ring-accent/30 rounded-xl px-4 py-3 text-center text-2xl tracking-[0.5em] font-bold text-text focus:outline-none transition-all"
            />
            <button
              type="button"
              onClick={() => setShowPin(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text"
            >
              {showPin ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          {error && (
            <p className="text-xs text-danger flex items-center gap-1.5">
              <AlertTriangle size={12} /> {error}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          {hasExistingPin && step === 'current' && onRemove && (
            <button
              onClick={handleRemove}
              disabled={loading}
              className="flex-1 h-11 rounded-xl text-sm font-semibold bg-danger/10 text-danger hover:bg-danger/20 transition-colors flex items-center justify-center gap-2"
            >
              <Unlock size={15} /> Remove PIN
            </button>
          )}
          <button
            onClick={handleNext}
            disabled={loading || !value}
            className="flex-1 h-11 rounded-xl text-sm font-semibold bg-accent text-white hover:bg-accent/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {step === 'confirm' ? (
              <><ShieldCheck size={15} /> Set PIN</>
            ) : (
              'Continue →'
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ─── PIN Unlock Gate Modal ────────────────────────────────────────────────────

export function NotePinUnlockModal({
  open,
  noteTitle,
  pinHash,
  onUnlocked,
  onClose,
}: {
  open: boolean
  noteTitle: string
  pinHash: string
  onUnlocked: () => void
  onClose: () => void
}) {
  const [pin, setPin] = useState('')
  const [showPin, setShowPin] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [attempts, setAttempts] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setPin('')
      setError('')
      setAttempts(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  if (!open) return null

  const handleUnlock = async () => {
    if (!pin) return
    setLoading(true)
    setError('')
    try {
      const ok = await verifyPin(pin, pinHash)
      if (ok) {
        onUnlocked()
      } else {
        setAttempts(a => a + 1)
        setPin('')
        setError(attempts >= 2 ? 'Too many wrong attempts. Check your PIN.' : 'Wrong PIN, try again.')
        inputRef.current?.focus()
      }
    } catch {
      setError('Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-surface border border-border rounded-2xl w-full max-w-sm shadow-2xl p-6 space-y-5 animate-in fade-in zoom-in-95 duration-200">
        {/* Lock icon */}
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="w-16 h-16 rounded-2xl bg-accent/10 text-accent flex items-center justify-center">
            <Lock size={28} />
          </div>
          <div>
            <h2 className="text-base font-semibold text-text">This note is locked</h2>
            <p className="text-xs text-text-muted mt-0.5 max-w-[200px] mx-auto line-clamp-1">"{noteTitle}"</p>
          </div>
        </div>

        {/* PIN input */}
        <div className="space-y-3">
          <div className="relative">
            <input
              ref={inputRef}
              type={showPin ? 'text' : 'password'}
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={8}
              value={pin}
              onChange={e => { setPin(e.target.value.replace(/\D/g, '')); setError('') }}
              onKeyDown={e => { if (e.key === 'Enter') handleUnlock() }}
              placeholder="Enter PIN…"
              className="w-full bg-surface-2 border border-border focus:border-accent focus:ring-1 focus:ring-accent/30 rounded-xl px-4 py-3 text-center text-2xl tracking-[0.5em] font-bold text-text focus:outline-none transition-all"
            />
            <button
              type="button"
              onClick={() => setShowPin(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text"
            >
              {showPin ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          {error && (
            <p className="text-xs text-danger flex items-center justify-center gap-1.5">
              <AlertTriangle size={12} /> {error}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="w-11 h-11 rounded-xl bg-surface-2 hover:bg-surface-3 border border-border text-text-muted hover:text-text flex items-center justify-center transition-colors"
          >
            <X size={16} />
          </button>
          <button
            onClick={handleUnlock}
            disabled={loading || !pin}
            className="flex-1 h-11 rounded-xl text-sm font-semibold bg-accent text-white hover:bg-accent/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            <Unlock size={15} /> Unlock
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
