import { useState } from 'react'
import { Send, X, AlertCircle } from 'lucide-react'
import { useFriendsQuery } from '../../hooks/useFriendsQuery'
import { getOrCreateDirectConversation, sendMessage } from '../../api/messages'
import { haptic } from '../../lib/haptic'
import type { MessageAttachment } from '../../db/schema'

interface Props {
  open: boolean
  attachment: MessageAttachment
  attachmentTitle: string
  onClose: () => void
  onSuccess?: () => void
}

export function ShareWithFriendModal({
  open,
  attachment,
  attachmentTitle,
  onClose,
  onSuccess,
}: Props) {
  const { data: friends = [], isLoading } = useFriendsQuery()
  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(null)
  const [optionalText, setOptionalText] = useState('')
  const [sending, setSending] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  if (!open) return null

  const handleSend = async () => {
    if (!selectedFriendId) return

    setSending(true)
    setErrorMsg(null)
    haptic('light')

    try {
      // 1. Get or create conversation with chosen friend
      const convId = await getOrCreateDirectConversation(selectedFriendId)

      // 2. Send attachment message
      await sendMessage({
        conversationId: convId,
        kind: 'attachment',
        body: optionalText.trim() ? optionalText.trim() : null,
        attachment,
      })

      haptic('success')
      onSuccess?.()
      onClose()
    } catch (err: unknown) {
      console.error('[ShareWithFriend] Send error:', err)
      setErrorMsg((err as Error)?.message || 'Failed to send')
      haptic('error')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-surface border border-border rounded-3xl w-full max-w-sm p-6 shadow-2xl space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-text">Send to a Friend</h3>
            <p className="text-xs text-text-muted truncate max-w-[240px]">
              Sharing: {attachmentTitle}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-text-muted hover:text-text hover:bg-surface-2 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Friend Selection */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-text-secondary">Select Friend</label>
          <div className="max-h-48 overflow-y-auto space-y-1.5 border border-border/80 rounded-2xl p-2 bg-surface-2/40">
            {isLoading ? (
              <div className="p-4 text-center text-xs text-text-muted">Loading friends…</div>
            ) : friends.length === 0 ? (
              <div className="p-4 text-center text-xs text-text-muted">
                No friends found. Connect with a friend first.
              </div>
            ) : (
              friends.map(f => {
                const isSelected = selectedFriendId === f.id
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setSelectedFriendId(f.id)}
                    className={`w-full p-2.5 rounded-xl text-left flex items-center gap-3 transition-colors ${
                      isSelected
                        ? 'bg-accent/15 border border-accent/40 text-text'
                        : 'hover:bg-surface-2 text-text-secondary border border-transparent'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-full bg-accent/20 border border-accent/30 flex items-center justify-center text-accent text-xs font-bold flex-shrink-0">
                      {f.display_name?.slice(0, 2).toUpperCase() || f.username.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold text-text truncate">
                        {f.display_name || f.username}
                      </div>
                      <div className="text-[11px] text-text-muted truncate">
                        @{f.username}
                      </div>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>

        {/* Optional note */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-text-secondary">Add a message (optional)</label>
          <input
            type="text"
            value={optionalText}
            onChange={e => setOptionalText(e.target.value)}
            placeholder="Hey, check this out…"
            maxLength={200}
            className="w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-xs text-text placeholder:text-text-muted focus:outline-none focus:border-accent"
          />
        </div>

        {errorMsg && (
          <div className="p-3 bg-danger/10 border border-danger/30 rounded-xl text-xs text-danger flex items-center gap-2">
            <AlertCircle size={14} className="flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Send Button */}
        <div className="flex items-center gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 px-3 rounded-xl border border-border text-xs font-medium text-text-secondary hover:bg-surface-2 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={!selectedFriendId || sending}
            className="flex-1 py-2.5 px-3 rounded-xl bg-accent text-white text-xs font-medium hover:bg-accent/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-sm"
          >
            <Send size={13} />
            <span>{sending ? 'Sending…' : 'Send'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}

