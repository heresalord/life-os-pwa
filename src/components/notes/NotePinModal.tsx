import { useEffect, useRef, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Lock, Unlock, X, Delete } from 'lucide-react'
import { verifyPin } from '../../hooks/useNoteMutations'

const PIN_LENGTH = 4

function PinDots({ length, filled }: { length: number; filled: number }) {
  return (
    <div className="flex items-center justify-center gap-3">
      {Array.from({ length }).map((_, i) => (
        <div
          key={i}
          className={`w-3.5 h-3.5 rounded-full border-2 transition-all ${
            i < filled ? 'bg-accent border-accent' : 'border-border bg-transparent'
          }`}
        />
      ))}
    </div>
  )
}

function Keypad({ onDigit, onDelete }: { onDigit: (d: string) => void; onDelete: () => void }) {
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del']
  return (
    <div className="grid grid-cols-3 gap-3 w-full max-w-[260px] mx-auto">
      {keys.map((k, i) => {
        if (k === '') return <div key={i} />
        if (k === 'del') {
          return (
            <button
              key={i}
              type="button"
              onClick={onDelete}
              className="h-14 rounded-2xl flex items-center justify-center text-text-secondary hover:bg-surface-2 active:scale-95 transition-all"
            >
              <Delete size={20} />
            </button>
          )
        }
        return (
          <button
            key={i}
            type="button"
            onClick={() => onDigit(k)}
            className="h-14 rounded-2xl bg-surface-2 border border-border/60 text-lg font-semibold text-text hover:bg-surface-3 active:scale-95 transition-all"
          >
            {k}
          </button>
        )
      })}
    </div>
  )
}

/**
 * Set, change, or remove a note's PIN. Two steps when setting a fresh PIN:
 * enter it, then confirm it matches before saving.
 */
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
  const [stage, setStage] = useState<'enter' | 'confirm'>('enter')
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setStage('enter')
      setPin('')
      setConfirmPin('')
      setError(null)
    }
  }, [open])

  const current = stage === 'enter' ? pin : confirmPin
  const setCurrent = stage === 'enter' ? setPin : setConfirmPin

  const handleDigit = (d: string) => {
    if (current.length >= PIN_LENGTH) return
    const next = current + d
    setCurrent(next)
    setError(null)
    if (next.length === PIN_LENGTH) {
      if (stage === 'enter') {
        setTimeout(() => setStage('confirm'), 150)
      } else {
        if (next === pin) {
          setSaving(true)
          onSet(next).then(onClose).catch(() => setError('Something went wrong. Try again.')).finally(() => setSaving(false))
        } else {
          setError("PINs didn't match — try again.")
          setTimeout(() => { setConfirmPin(''); setStage('enter'); setPin('') }, 700)
        }
      }
    }
  }

  const handleDelete = () => setCurrent(current.slice(0, -1))

  return (
    <Dialog.Root open={open} onOpenChange={v => { if (!v) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-bg/85 backdrop-blur-sm" />
        <Dialog.Content
          className="fixed bottom-0 left-0 right-0 z-50 bg-surface border-t border-border rounded-t-2xl p-6 shadow-2xl sm:inset-auto sm:left-1/2 sm:-translate-x-1/2 sm:top-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-sm sm:rounded-2xl sm:border"
          style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
        >
          <div className="w-10 h-1 rounded-full bg-border mx-auto mb-5 sm:hidden" />
          <div className="flex items-center justify-between mb-6">
            <Dialog.Title className="text-base font-medium text-text flex items-center gap-2">
              <Lock size={16} className="text-accent" />
              {hasExistingPin ? 'Change PIN' : 'Lock with PIN'}
            </Dialog.Title>
            <Dialog.Close className="text-text-muted hover:text-text"><X size={18} /></Dialog.Close>
          </div>

          <div className="space-y-6">
            <div className="text-center space-y-1">
              <p className="text-sm text-text-secondary">
                {stage === 'enter' ? 'Enter a 4-digit PIN' : 'Confirm your PIN'}
              </p>
              {error && <p className="text-xs text-danger font-medium">{error}</p>}
            </div>

            <PinDots length={PIN_LENGTH} filled={current.length} />

            <Keypad onDigit={handleDigit} onDelete={handleDelete} />

            {saving && <p className="text-center text-xs text-text-muted">Saving…</p>}

            {hasExistingPin && onRemove && (
              <button
                onClick={() => { onRemove().then(onClose) }}
                className="w-full py-2.5 text-sm font-medium text-danger hover:bg-danger/10 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <Unlock size={14} /> Remove PIN Lock
              </button>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

/**
 * Prompt for a note's existing PIN and verify it against the stored hash
 * before letting the caller reveal the note's content.
 */
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
  const [error, setError] = useState(false)
  const [checking, setChecking] = useState(false)
  const shakeRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) { setPin(''); setError(false) }
  }, [open])

  const handleDigit = async (d: string) => {
    if (pin.length >= PIN_LENGTH || checking) return
    const next = pin + d
    setPin(next)
    if (next.length === PIN_LENGTH) {
      setChecking(true)
      const ok = await verifyPin(next, pinHash)
      setChecking(false)
      if (ok) {
        onUnlocked()
      } else {
        setError(true)
        setTimeout(() => { setPin(''); setError(false) }, 500)
      }
    }
  }

  const handleDelete = () => setPin(p => p.slice(0, -1))

  return (
    <Dialog.Root open={open} onOpenChange={v => { if (!v) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-bg/85 backdrop-blur-sm" />
        <Dialog.Content
          className="fixed bottom-0 left-0 right-0 z-50 bg-surface border-t border-border rounded-t-2xl p-6 shadow-2xl sm:inset-auto sm:left-1/2 sm:-translate-x-1/2 sm:top-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-sm sm:rounded-2xl sm:border"
          style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
        >
          <div className="w-10 h-1 rounded-full bg-border mx-auto mb-5 sm:hidden" />
          <div className="flex items-center justify-between mb-6">
            <Dialog.Title className="text-base font-medium text-text flex items-center gap-2 min-w-0">
              <Lock size={16} className="text-accent flex-shrink-0" />
              <span className="truncate">{noteTitle}</span>
            </Dialog.Title>
            <Dialog.Close className="text-text-muted hover:text-text flex-shrink-0"><X size={18} /></Dialog.Close>
          </div>

          <div className="space-y-6">
            <p className="text-sm text-text-secondary text-center">Enter PIN to unlock</p>

            <div ref={shakeRef} className={error ? 'animate-[shake_0.4s_ease-in-out]' : ''}>
              <PinDots length={PIN_LENGTH} filled={pin.length} />
            </div>
            {error && <p className="text-center text-xs text-danger font-medium">Incorrect PIN</p>}

            <Keypad onDigit={handleDigit} onDelete={handleDelete} />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
