import React, { useState } from 'react'
import { X, Send, Copy, Check, Users } from 'lucide-react'
import { createShareCode } from '../../lib/share'

interface ShareModalProps {
  isOpen: boolean
  onClose: () => void
  itemType: 'project' | 'task' | 'inbox'
  itemId: string
  itemName: string
}

export function ShareModal({ isOpen, onClose, itemType, itemId, itemName }: ShareModalProps) {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [shareCode, setShareCode] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const handleCreateShare = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return

    setLoading(true)
    setError(null)
    try {
      const code = await createShareCode(itemType, itemId, email.trim())
      setShareCode(code)
    } catch (err: any) {
      setError(err.message || 'Failed to create share code')
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = () => {
    if (!shareCode) return
    navigator.clipboard.writeText(shareCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-bg/85 backdrop-blur-md" onClick={onClose} />

      {/* Modal Card */}
      <div className="relative z-10 w-full max-w-md bg-surface border border-border rounded-2xl p-5 shadow-2xl animate-in fade-in zoom-in-95 duration-150 text-left">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-text flex items-center gap-2">
            <Users size={16} className="text-accent" />
            Share {itemType}
          </h3>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-text-muted hover:text-text hover:bg-surface-2 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-4">
          <div>
            <p className="text-xs text-text-secondary">
              Sharing: <span className="font-semibold text-text">"{itemName}"</span>
            </p>
            <p className="text-[10px] text-text-muted mt-1 leading-normal">
              This creates a collaborative share. Anyone you share this code with will be able to view and edit this item when they redeem it in their Life OS account.
            </p>
          </div>

          {!shareCode ? (
            <form onSubmit={handleCreateShare} className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-1">
                  Recipient's Email
                </label>
                <input
                  type="email"
                  required
                  placeholder="collaborator@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-surface-2 border border-border focus:border-accent rounded-xl px-3 py-2 text-sm text-text focus:outline-none transition-colors"
                />
              </div>

              {error && (
                <p className="text-xs text-danger font-medium">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading || !email.trim()}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-accent text-bg font-semibold rounded-xl text-xs hover:bg-accent-dim transition-colors disabled:opacity-50"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-bg/40 border-t-bg rounded-full animate-spin" />
                ) : (
                  <>
                    <Send size={12} />
                    Generate Share Code
                  </>
                )}
              </button>
            </form>
          ) : (
            <div className="space-y-3.5 bg-surface-2 border border-border/80 rounded-xl p-4 text-center">
              <p className="text-[11px] text-text-secondary">
                Share this unique code with the user:
              </p>
              <div className="text-lg font-mono font-bold text-accent select-all bg-surface px-4 py-2 rounded-xl border border-border inline-block tracking-wide">
                {shareCode}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleCopy}
                  className="flex-1 flex items-center justify-center gap-2 py-2 border border-border hover:border-text-secondary rounded-xl text-xs text-text transition-colors font-medium"
                >
                  {copied ? (
                    <>
                      <Check size={12} className="text-success" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy size={12} />
                      Copy Code
                    </>
                  )}
                </button>
                <button
                  onClick={() => setShareCode(null)}
                  className="px-4 py-2 border border-border bg-surface-2 hover:bg-surface-3 text-text-secondary hover:text-text rounded-xl text-xs transition-colors"
                >
                  Share with another
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
