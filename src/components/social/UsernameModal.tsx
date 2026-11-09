import React, { useState } from 'react'
import { AtSign, X, AlertCircle } from 'lucide-react'
import { useFriendMutations } from '../../hooks/useFriendMutations'

interface Props {
  open: boolean
  onClose: () => void
  onSuccess?: (username: string) => void
}

export function UsernameModal({ open, onClose, onSuccess }: Props) {
  const { setUsername } = useFriendMutations()
  const [usernameInput, setUsernameInput] = useState('')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  if (!open) return null

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)

    const cleaned = usernameInput.toLowerCase().trim()
    if (!cleaned) {
      setErrorMsg('Please enter a username')
      return
    }

    if (!/^[a-z0-9_]{3,20}$/.test(cleaned)) {
      setErrorMsg('3-20 characters: letters, numbers, and underscores only')
      return
    }

    try {
      const saved = await setUsername.mutateAsync(cleaned)
      onSuccess?.(saved)
      onClose()
    } catch (err: unknown) {
      const msg = (err as Error)?.message || 'Failed to set username'
      setErrorMsg(msg)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-sm p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent">
              <AtSign size={18} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-text">Choose a Username</h2>
              <p className="text-xs text-text-muted">Required for friends & sharing</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-text-muted hover:text-text hover:bg-surface-2 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-text-secondary">Username</label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-text-muted text-sm select-none">@</span>
              <input
                type="text"
                value={usernameInput}
                onChange={e => {
                  setUsernameInput(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))
                  setErrorMsg(null)
                }}
                placeholder="yourname"
                maxLength={20}
                className="w-full bg-surface-2 border border-border rounded-xl pl-8 pr-3 py-2 text-sm text-text placeholder:text-text-muted focus:outline-none focus:border-accent"
                autoFocus
              />
            </div>
            <p className="text-[11px] text-text-muted">
              Can be changed once every 30 days. Letters, numbers, and underscores only.
            </p>
          </div>

          {errorMsg && (
            <div className="p-3 bg-danger/10 border border-danger/30 rounded-xl text-xs text-danger flex items-center gap-2">
              <AlertCircle size={14} className="flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 px-3 rounded-xl border border-border text-xs font-medium text-text-secondary hover:bg-surface-2 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={setUsername.isPending || !usernameInput.trim()}
              className="flex-1 py-2 px-3 rounded-xl bg-accent text-white text-xs font-medium hover:bg-accent/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-sm"
            >
              {setUsername.isPending ? 'Saving…' : 'Claim Username'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
