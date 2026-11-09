import React, { useState, useEffect, useRef, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ChevronLeft,
  Plus,
  ArrowUp,
  MoreVertical,
  BellOff,
  Ban,
  Check,
  CheckCheck,
  Clock,
  Trash2,
  Edit2,
  Copy,
  Paperclip,
  X,
} from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useMessagesQuery } from '../../hooks/useMessagesQuery'
import { useConversationsQuery } from '../../hooks/useConversationsQuery'
import { useMessageMutations } from '../../hooks/useMessageMutations'
import { useFriendMutations } from '../../hooks/useFriendMutations'
import { AttachmentBubbleCard } from '../../components/messages/AttachmentBubbleCard'
import { SendAttachmentModal } from '../../components/messages/SendAttachmentModal'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { haptic } from '../../lib/haptic'
import type { Message, MessageAttachment } from '../../db/schema'

function formatDateHeader(isoString: string): string {
  const d = new Date(isoString)
  const now = new Date()
  const isToday =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear()

  if (isToday) return 'Today'

  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (
    d.getDate() === yesterday.getDate() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getFullYear() === yesterday.getFullYear()
  ) {
    return 'Yesterday'
  }

  return d.toLocaleDateString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

export function ConversationPage() {
  const { id: conversationId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

  const { conversations } = useConversationsQuery()
  const { messages, isLoading } = useMessagesQuery(conversationId)
  const { sendMessage, unsendMessage, editMessage, muteConversation } =
    useMessageMutations(conversationId)
  const { blockUser } = useFriendMutations()

  const conversation = conversations.find(c => c.conversation_id === conversationId)

  const [inputText, setInputText] = useState('')
  const [stagedAttachment, setStagedAttachment] = useState<MessageAttachment | null>(null)
  const [attachmentModalOpen, setAttachmentModalOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [activeMessageMenuId, setActiveMessageMenuId] = useState<string | null>(null)

  // Edit message state
  const [editingMessage, setEditingMessage] = useState<Message | null>(null)
  const [editBodyText, setEditBodyText] = useState('')

  // Confirmation dialogs
  const [confirmUnsendId, setConfirmUnsendId] = useState<string | null>(null)
  const [confirmBlockOpen, setConfirmBlockOpen] = useState(false)

  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Auto-scroll to bottom on messages update
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages.length])

  const peerDisplayName =
    conversation?.peer_display_name || conversation?.peer_username || 'Friend'
  const peerInitials = peerDisplayName.slice(0, 2).toUpperCase()
  const peerLastReadAt = conversation?.peer_last_read_at

  // Find latest message sent by current user to show Delivery / Read status
  const latestSentMessage = useMemo(() => {
    if (!user) return null
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].sender_id === user.id && !messages[i].deleted_at) {
        return messages[i]
      }
    }
    return null
  }, [messages, user])

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const text = inputText.trim()
    if (!text && !stagedAttachment) return

    haptic('light')
    const toSendText = text || null
    const toSendAttachment = stagedAttachment

    setInputText('')
    setStagedAttachment(null)

    try {
      await sendMessage.mutateAsync({
        body: toSendText,
        kind: toSendAttachment ? 'attachment' : 'text',
        attachment: toSendAttachment,
      })
    } catch (err: unknown) {
      console.error('[ConversationPage] Send failed:', err)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleCopyText = (body: string | null) => {
    if (!body) return
    navigator.clipboard.writeText(body)
    haptic('light')
    setActiveMessageMenuId(null)
  }

  const handleStartEdit = (msg: Message) => {
    setEditingMessage(msg)
    setEditBodyText(msg.body || '')
    setActiveMessageMenuId(null)
  }

  const handleSaveEdit = async () => {
    if (!editingMessage || !editBodyText.trim()) return
    haptic('light')
    try {
      await editMessage.mutateAsync({
        messageId: editingMessage.id,
        newBody: editBodyText.trim(),
      })
      setEditingMessage(null)
    } catch (err: unknown) {
      alert((err as Error)?.message || 'Failed to edit message')
    }
  }

  const handleExecuteUnsend = async () => {
    if (!confirmUnsendId) return
    haptic('light')
    try {
      await unsendMessage.mutateAsync(confirmUnsendId)
      setConfirmUnsendId(null)
      setActiveMessageMenuId(null)
    } catch (err: unknown) {
      alert((err as Error)?.message || 'Failed to unsend message')
    }
  }

  const handleBlockPeer = async () => {
    if (!conversation?.peer_id) return
    haptic('medium')
    try {
      await blockUser.mutateAsync(conversation.peer_id)
      setConfirmBlockOpen(false)
      navigate('/messages')
    } catch (err: unknown) {
      alert((err as Error)?.message || 'Failed to block user')
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-w-2xl mx-auto -mx-4 -my-4 md:mx-auto md:my-0 md:rounded-3xl bg-bg border-x border-border/40 shadow-xs overflow-hidden select-none">
      {/* ── iOS iMessage Header ────────────────────────────────────── */}
      <div className="flex items-center justify-between px-3 py-2.5 bg-surface/90 backdrop-blur-md border-b border-border z-20 flex-shrink-0">
        <button
          onClick={() => navigate('/messages')}
          className="flex items-center gap-1 text-accent hover:text-accent/80 font-medium text-sm py-1 pr-2 rounded-lg transition-colors active:scale-95"
          aria-label="Back to Messages"
        >
          <ChevronLeft size={22} className="-ml-1" />
          <span className="hidden sm:inline">Messages</span>
        </button>

        {/* Contact Info (Center) */}
        <div className="flex flex-col items-center min-w-0 cursor-pointer">
          <div className="w-8 h-8 rounded-full bg-accent/15 border border-accent/25 flex items-center justify-center text-accent text-xs font-bold overflow-hidden shadow-xs">
            {conversation?.peer_avatar_url ? (
              <img
                src={conversation.peer_avatar_url}
                alt={peerDisplayName}
                className="w-full h-full object-cover"
              />
            ) : (
              peerInitials
            )}
          </div>
          <span className="text-xs font-semibold text-text truncate max-w-[160px] sm:max-w-[240px] mt-0.5">
            {peerDisplayName}
          </span>
          {conversation?.peer_username && (
            <span className="text-[10px] text-text-muted truncate">
              @{conversation.peer_username}
            </span>
          )}
        </div>

        {/* Action Menu (Right) */}
        <div className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-2 rounded-full text-text-muted hover:text-text hover:bg-surface-2 transition-colors"
            title="Options"
          >
            <MoreVertical size={18} />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 w-48 bg-surface border border-border rounded-2xl shadow-xl py-1 z-30 animate-fade-in divide-y divide-border/60">
              <div className="px-3 py-2 text-[11px] text-text-muted font-medium">
                Chat settings
              </div>
              <button
                onClick={() => {
                  if (conversationId) {
                    muteConversation.mutate({
                      convId: conversationId,
                      muted: !conversation?.muted,
                    })
                  }
                  setMenuOpen(false)
                }}
                className="w-full px-3 py-2 text-left text-xs text-text hover:bg-surface-2 flex items-center gap-2 transition-colors"
              >
                <BellOff size={14} className="text-text-muted" />
                <span>{conversation?.muted ? 'Unmute' : 'Mute Notifications'}</span>
              </button>
              <button
                onClick={() => {
                  setConfirmBlockOpen(true)
                  setMenuOpen(false)
                }}
                className="w-full px-3 py-2 text-left text-xs text-danger hover:bg-danger/10 flex items-center gap-2 transition-colors"
              >
                <Ban size={14} />
                <span>Block User</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Message Bubble Stream ─────────────────────────────────── */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-bg/50"
      >
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-6 h-6 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-14 h-14 rounded-full bg-accent/10 text-accent flex items-center justify-center mb-3">
              <span className="text-xl">👋</span>
            </div>
            <h4 className="text-sm font-semibold text-text mb-1">
              Start chatting with {peerDisplayName}
            </h4>
            <p className="text-xs text-text-muted max-w-xs">
              Say hello or tap the <span className="font-bold text-accent">+</span> button below to share a note, task, or inbox idea.
            </p>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isMe = msg.sender_id === user?.id
            const isLatestSent = latestSentMessage?.id === msg.id
            const isDeleted = !!msg.deleted_at
            const isOptimistic = msg.id.startsWith('opt-')
            const isAttachment = msg.kind === 'attachment' && !!msg.attachment

            // Date separator
            const prevMsg = messages[index - 1]
            const showDateHeader =
              !prevMsg ||
              new Date(msg.created_at).toDateString() !==
                new Date(prevMsg.created_at).toDateString()

            // 15-minute edit allowance
            const canEdit =
              isMe &&
              !isDeleted &&
              msg.kind === 'text' &&
              Date.now() - new Date(msg.created_at).getTime() < 15 * 60 * 1000

            // Read receipt computation
            const isRead =
              peerLastReadAt &&
              new Date(peerLastReadAt).getTime() >= new Date(msg.created_at).getTime()

            return (
              <React.Fragment key={msg.id}>
                {/* Centered Date Separator */}
                {showDateHeader && (
                  <div className="flex justify-center my-3">
                    <span className="px-3 py-1 bg-surface-2/60 border border-border/40 text-[11px] font-medium text-text-muted rounded-full shadow-2xs">
                      {formatDateHeader(msg.created_at)}
                    </span>
                  </div>
                )}

                {/* Message Row */}
                <div
                  className={`flex flex-col group ${
                    isMe ? 'items-end' : 'items-start'
                  }`}
                >
                  {/* Deleted message view */}
                  {isDeleted ? (
                    <div className="px-3.5 py-2 rounded-2xl border border-dashed border-border bg-surface-2/30 text-xs italic text-text-muted max-w-[80%]">
                      {isMe ? 'You unsent a message' : 'Message unsent'}
                    </div>
                  ) : (
                    <div className="relative flex items-center gap-1.5 max-w-[82%] sm:max-w-[75%]">
                      {/* Left action button (for my messages) */}
                      {isMe && !isOptimistic && (
                        <button
                          onClick={() =>
                            setActiveMessageMenuId(
                              activeMessageMenuId === msg.id ? null : msg.id
                            )
                          }
                          className="opacity-0 group-hover:opacity-100 p-1 text-text-muted hover:text-text rounded-full transition-opacity"
                        >
                          <MoreVertical size={14} />
                        </button>
                      )}

                      {/* Bubble */}
                      <div
                        className={`relative px-4 py-2.5 transition-all shadow-xs ${
                          isMe
                            ? 'bg-[#007AFF] text-white rounded-[20px] rounded-br-[4px]'
                            : 'bg-surface border border-border/60 text-text rounded-[20px] rounded-bl-[4px]'
                        } ${isOptimistic ? 'opacity-70' : ''}`}
                      >
                        {/* Attachment Card */}
                        {isAttachment && (
                          <div className="mb-1.5">
                            <AttachmentBubbleCard
                              attachment={(msg.attachment as unknown) as MessageAttachment}
                              isSender={isMe}
                            />
                          </div>
                        )}

                        {/* Text Body */}
                        {msg.body && (
                          <p className="text-sm leading-relaxed whitespace-pre-wrap break-words font-body">
                            {msg.body}
                          </p>
                        )}

                        {/* Edited Indicator */}
                        {msg.edited_at && (
                          <span
                            className={`text-[9px] block text-right mt-0.5 ${
                              isMe ? 'text-white/70' : 'text-text-muted'
                            }`}
                          >
                            (edited)
                          </span>
                        )}
                      </div>

                      {/* Right action button (for peer messages) */}
                      {!isMe && (
                        <button
                          onClick={() =>
                            setActiveMessageMenuId(
                              activeMessageMenuId === msg.id ? null : msg.id
                            )
                          }
                          className="opacity-0 group-hover:opacity-100 p-1 text-text-muted hover:text-text rounded-full transition-opacity"
                        >
                          <MoreVertical size={14} />
                        </button>
                      )}

                      {/* Context Popover Menu */}
                      {activeMessageMenuId === msg.id && (
                        <div
                          className={`absolute bottom-full mb-1 z-30 bg-surface border border-border rounded-xl shadow-xl py-1 min-w-[130px] animate-fade-in ${
                            isMe ? 'right-0' : 'left-0'
                          }`}
                        >
                          {msg.body && (
                            <button
                              onClick={() => handleCopyText(msg.body)}
                              className="w-full px-3 py-1.5 text-left text-xs text-text hover:bg-surface-2 flex items-center gap-2"
                            >
                              <Copy size={13} />
                              <span>Copy</span>
                            </button>
                          )}

                          {canEdit && (
                            <button
                              onClick={() => handleStartEdit(msg)}
                              className="w-full px-3 py-1.5 text-left text-xs text-text hover:bg-surface-2 flex items-center gap-2"
                            >
                              <Edit2 size={13} />
                              <span>Edit</span>
                            </button>
                          )}

                          {isMe && (
                            <button
                              onClick={() => {
                                setConfirmUnsendId(msg.id)
                                setActiveMessageMenuId(null)
                              }}
                              className="w-full px-3 py-1.5 text-left text-xs text-danger hover:bg-danger/10 flex items-center gap-2"
                            >
                              <Trash2 size={13} />
                              <span>Unsend</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Delivery / Read / Sending status for latest sent message */}
                  {isMe && isLatestSent && !isDeleted && (
                    <div className="flex items-center gap-1 text-[10px] text-text-muted mt-1 px-1">
                      {isOptimistic ? (
                        <>
                          <Clock size={11} className="animate-spin text-accent" />
                          <span>Sending...</span>
                        </>
                      ) : isRead ? (
                        <>
                          <CheckCheck size={12} className="text-[#007AFF]" />
                          <span>Read</span>
                        </>
                      ) : (
                        <>
                          <Check size={12} />
                          <span>Delivered</span>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </React.Fragment>
            )
          })
        )}
      </div>

      {/* ── Edit Message Overlay ──────────────────────────────────── */}
      {editingMessage && (
        <div className="p-3 bg-surface border-t border-border flex items-center gap-2 animate-slide-up">
          <div className="flex-1">
            <span className="text-[10px] font-semibold text-accent uppercase tracking-wider block mb-1">
              Editing Message
            </span>
            <input
              type="text"
              value={editBodyText}
              onChange={e => setEditBodyText(e.target.value)}
              className="w-full bg-surface-2 border border-border rounded-xl px-3 py-1.5 text-xs text-text focus:outline-none focus:border-accent"
              autoFocus
            />
          </div>
          <button
            onClick={handleSaveEdit}
            className="px-3 py-1.5 bg-accent text-white rounded-xl text-xs font-semibold hover:bg-accent/90"
          >
            Save
          </button>
          <button
            onClick={() => setEditingMessage(null)}
            className="p-1.5 text-text-muted hover:text-text rounded-xl"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* ── Staged Attachment Preview Chip ────────────────────────── */}
      {stagedAttachment && (
        <div className="px-4 py-2 bg-surface-2/60 border-t border-border flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Paperclip size={14} className="text-accent flex-shrink-0" />
            <span className="text-xs font-medium text-text truncate">
              Attached: {stagedAttachment.type} ({String(stagedAttachment.snapshot.title || stagedAttachment.snapshot.text || 'Item')})
            </span>
          </div>
          <button
            onClick={() => setStagedAttachment(null)}
            className="p-1 text-text-muted hover:text-danger rounded-full"
            title="Remove attachment"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* ── iOS iMessage Bottom Composer Capsule ──────────────────── */}
      <form
        onSubmit={handleSend}
        className="p-3 bg-surface/90 backdrop-blur-md border-t border-border flex items-end gap-2 flex-shrink-0"
      >
        {/* Attachment "+" button */}
        <button
          type="button"
          onClick={() => {
            haptic('light')
            setAttachmentModalOpen(true)
          }}
          className="w-9 h-9 rounded-full bg-surface-2 hover:bg-surface-3 text-text-secondary hover:text-text flex items-center justify-center transition-colors flex-shrink-0 active:scale-95"
          title="Share Note, Task, or Inbox item"
        >
          <Plus size={19} />
        </button>

        {/* Text Input Capsule */}
        <div className="flex-1 bg-surface-2 border border-border/80 focus-within:border-accent/40 rounded-[22px] px-4 py-2 min-h-[38px] max-h-32 flex items-center transition-colors shadow-inner">
          <textarea
            ref={inputRef}
            rows={1}
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message"
            className="w-full bg-transparent text-sm text-text placeholder:text-text-muted resize-none focus:outline-none max-h-24 leading-relaxed font-body"
          />
        </div>

        {/* Send Button */}
        <button
          type="submit"
          disabled={!inputText.trim() && !stagedAttachment}
          className={`w-9 h-9 rounded-full flex items-center justify-center transition-all flex-shrink-0 active:scale-95 ${
            inputText.trim() || stagedAttachment
              ? 'bg-[#007AFF] text-white shadow-sm hover:bg-[#007AFF]/90'
              : 'bg-surface-2 text-text-muted/40 cursor-not-allowed'
          }`}
          title="Send"
        >
          <ArrowUp size={18} strokeWidth={2.5} />
        </button>
      </form>

      {/* ── Attachment Picker Modal ───────────────────────────────── */}
      <SendAttachmentModal
        open={attachmentModalOpen}
        onClose={() => setAttachmentModalOpen(false)}
        onSelectAttachment={att => {
          setStagedAttachment(att)
          haptic('light')
        }}
      />

      {/* ── Unsend Confirmation Dialog ─────────────────────────────── */}
      <ConfirmDialog
        open={!!confirmUnsendId}
        onOpenChange={open => !open && setConfirmUnsendId(null)}
        title="Unsend Message"
        description="Are you sure you want to unsend this message? It will be removed for everyone in this chat."
        confirmText="Unsend"
        variant="danger"
        onConfirm={handleExecuteUnsend}
      />

      {/* ── Block User Confirmation Dialog ─────────────────────────── */}
      <ConfirmDialog
        open={confirmBlockOpen}
        onOpenChange={setConfirmBlockOpen}
        title="Block User"
        description={`Are you sure you want to block ${peerDisplayName}? They will no longer be able to message you or see your profile.`}
        confirmText="Block"
        variant="danger"
        onConfirm={handleBlockPeer}
      />
    </div>
  )
}

