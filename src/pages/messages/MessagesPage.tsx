import React, { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  SquarePen,
  Search,
  X,
  BellOff,
  EyeOff,
  MoreVertical,
  MessageSquare,
  Users,
  ChevronRight,
} from 'lucide-react'
import { useConversationsQuery } from '../../hooks/useConversationsQuery'
import { useMessageMutations } from '../../hooks/useMessageMutations'
import { useFriendsQuery } from '../../hooks/useFriendsQuery'
import { getOrCreateDirectConversation } from '../../api/messages'
import { haptic } from '../../lib/haptic'

function formatMessageTime(isoString: string | null): string {
  if (!isoString) return ''
  const date = new Date(isoString)
  const now = new Date()

  // Same day: 9:41 AM
  const isSameDay =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear()

  if (isSameDay) {
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  }

  // Yesterday
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear()
  ) {
    return 'Yesterday'
  }

  // Within past 6 days: e.g. "Monday"
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays < 7) {
    return date.toLocaleDateString([], { weekday: 'short' })
  }

  // Else: "Nov 4" or "11/4/26"
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

export function MessagesPage() {
  const navigate = useNavigate()
  const { conversations, isLoading } = useConversationsQuery()
  const { hideConversation, muteConversation } = useMessageMutations()
  const { data: friends = [] } = useFriendsQuery()

  const [search, setSearch] = useState('')
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null)
  const [showComposeModal, setShowComposeModal] = useState(false)
  const [startingChat, setStartingChat] = useState<string | null>(null)

  // Filter conversations by peer display name, username, or message body
  const filteredConversations = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return conversations
    return conversations.filter(c => {
      const name = (c.peer_display_name || '').toLowerCase()
      const uname = (c.peer_username || '').toLowerCase()
      const body = (c.latest_body || '').toLowerCase()
      return name.includes(q) || uname.includes(q) || body.includes(q)
    })
  }, [conversations, search])

  const handleStartChatWithFriend = async (friendId: string) => {
    try {
      setStartingChat(friendId)
      haptic('light')
      const conversationId = await getOrCreateDirectConversation(friendId)
      setShowComposeModal(false)
      navigate(`/messages/${conversationId}`)
    } catch (err: unknown) {
      console.error('[Messages] Start chat error:', err)
      alert((err as Error)?.message || 'Failed to start conversation')
    } finally {
      setStartingChat(null)
    }
  }

  const handleMute = async (cId: string, currentMuted: boolean, e: React.MouseEvent) => {
    e.stopPropagation()
    haptic('light')
    await muteConversation.mutateAsync({ convId: cId, muted: !currentMuted })
    setActiveMenuId(null)
  }

  const handleHide = async (cId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    haptic('light')
    await hideConversation.mutateAsync(cId)
    setActiveMenuId(null)
  }

  return (
    <div className="max-w-2xl mx-auto pb-20 select-none">
      {/* iOS Messages Navigation Header */}
      <div className="flex items-center justify-between pt-2 pb-4 px-1">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-text">
            Messages
          </h1>
        </div>

        <button
          onClick={() => {
            haptic('light')
            setShowComposeModal(true)
          }}
          className="w-10 h-10 rounded-full bg-accent/10 hover:bg-accent/20 text-accent flex items-center justify-center transition-colors shadow-xs active:scale-95"
          title="New Message"
          aria-label="New Message"
        >
          <SquarePen size={19} />
        </button>
      </div>

      {/* iOS Search Bar */}
      <div className="mb-4 relative">
        <div className="relative flex items-center">
          <Search
            size={16}
            className="absolute left-3.5 text-text-muted pointer-events-none"
          />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search"
            className="w-full bg-surface border border-border/80 focus:border-accent/40 rounded-2xl pl-10 pr-9 py-2 text-sm text-text placeholder:text-text-muted focus:outline-none transition-all shadow-xs"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 p-1 rounded-full text-text-muted hover:text-text"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Conversations List */}
      {isLoading ? (
        <div className="space-y-3 py-6">
          {[1, 2, 3].map(i => (
            <div
              key={i}
              className="flex items-center gap-3.5 p-3.5 bg-surface border border-border/60 rounded-2xl animate-pulse"
            >
              <div className="w-12 h-12 rounded-full bg-surface-2" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-surface-2 rounded-md w-1/3" />
                <div className="h-3 bg-surface-2 rounded-md w-2/3" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredConversations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
          <div className="w-16 h-16 rounded-3xl bg-accent/10 text-accent flex items-center justify-center mb-4 shadow-inner">
            <MessageSquare size={28} />
          </div>
          <h3 className="text-base font-semibold text-text mb-1">
            {search ? 'No conversations found' : 'No Messages Yet'}
          </h3>
          <p className="text-xs text-text-muted max-w-xs mb-6">
            {search
              ? `No messages matched "${search}".`
              : 'Chat directly with your friends and share notes, tasks, or inbox ideas in real time.'}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                haptic('light')
                setShowComposeModal(true)
              }}
              className="px-4 py-2 bg-accent text-white font-medium text-xs rounded-xl hover:bg-accent/90 transition-colors shadow-sm flex items-center gap-1.5 active:scale-95"
            >
              <SquarePen size={14} />
              <span>Start a conversation</span>
            </button>
            <button
              onClick={() => navigate('/friends')}
              className="px-4 py-2 bg-surface border border-border text-text font-medium text-xs rounded-xl hover:bg-surface-2 transition-colors flex items-center gap-1.5"
            >
              <Users size={14} />
              <span>Find friends</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-surface border border-border rounded-2xl divide-y divide-border/60 overflow-hidden shadow-xs">
          {filteredConversations.map(conv => {
            const displayName =
              conv.peer_display_name || conv.peer_username || 'Friend'
            const initials = displayName.slice(0, 2).toUpperCase()
            const hasUnread = (conv.unread_count || 0) > 0
            const preview =
              conv.latest_kind === 'attachment'
                ? '📎 Shared an item'
                : conv.latest_body || 'No messages yet'
            const timeStr = formatMessageTime(conv.last_message_at)
            const isMenuOpen = activeMenuId === conv.conversation_id

            return (
              <div
                key={conv.conversation_id}
                onClick={() => {
                  haptic('light')
                  navigate(`/messages/${conv.conversation_id}`)
                }}
                className={`relative group flex items-center gap-3.5 px-4 py-3.5 hover:bg-surface-2/60 active:bg-surface-2 cursor-pointer transition-colors ${
                  hasUnread ? 'bg-accent/5' : ''
                }`}
              >
                {/* Blue Unread Dot (iOS style) */}
                <div className="w-2 flex items-center justify-center flex-shrink-0">
                  {hasUnread && (
                    <span className="w-2.5 h-2.5 rounded-full bg-[#007AFF] shadow-xs animate-pulse" />
                  )}
                </div>

                {/* Avatar */}
                <div className="relative w-12 h-12 rounded-full bg-accent/15 border border-accent/25 flex items-center justify-center text-accent text-sm font-bold flex-shrink-0">
                  {conv.peer_avatar_url ? (
                    <img
                      src={conv.peer_avatar_url}
                      alt={displayName}
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    initials
                  )}
                </div>

                {/* Name, Message Preview, and Time */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className={`text-sm truncate ${
                          hasUnread
                            ? 'font-bold text-text'
                            : 'font-semibold text-text'
                        }`}
                      >
                        {displayName}
                      </span>
                      {conv.muted && (
                        <BellOff
                          size={12}
                          className="text-text-muted flex-shrink-0"
                        />
                      )}
                    </div>

                    <span
                      className={`text-xs flex-shrink-0 ${
                        hasUnread
                          ? 'text-[#007AFF] font-semibold'
                          : 'text-text-muted'
                      }`}
                    >
                      {timeStr}
                    </span>
                  </div>

                  <p
                    className={`text-xs truncate ${
                      hasUnread
                        ? 'text-text font-medium'
                        : 'text-text-muted'
                    }`}
                  >
                    {preview}
                  </p>
                </div>

                {/* Options menu button */}
                <div
                  className="relative flex-shrink-0"
                  onClick={e => e.stopPropagation()}
                >
                  <button
                    onClick={() =>
                      setActiveMenuId(
                        isMenuOpen ? null : conv.conversation_id
                      )
                    }
                    className="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-surface-2 transition-colors opacity-70 group-hover:opacity-100"
                    title="Options"
                  >
                    <MoreVertical size={16} />
                  </button>

                  {isMenuOpen && (
                    <div className="absolute right-0 top-full mt-1 w-44 bg-surface border border-border rounded-xl shadow-xl py-1 z-20 animate-fade-in">
                      <button
                        onClick={e =>
                          handleMute(conv.conversation_id, conv.muted, e)
                        }
                        className="w-full px-3 py-2 text-left text-xs text-text hover:bg-surface-2 flex items-center gap-2"
                      >
                        <BellOff size={14} className="text-text-muted" />
                        <span>{conv.muted ? 'Unmute' : 'Mute Notifications'}</span>
                      </button>
                      <button
                        onClick={e =>
                          handleHide(conv.conversation_id, e)
                        }
                        className="w-full px-3 py-2 text-left text-xs text-danger hover:bg-danger/10 flex items-center gap-2"
                      >
                        <EyeOff size={14} />
                        <span>Hide Conversation</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Compose / Pick Friend Modal */}
      {showComposeModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface border border-border rounded-t-3xl sm:rounded-3xl w-full max-w-md max-h-[80vh] flex flex-col shadow-2xl overflow-hidden animate-slide-up">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <SquarePen size={18} className="text-accent" />
                <h3 className="text-base font-semibold text-text">
                  New Message
                </h3>
              </div>
              <button
                onClick={() => setShowComposeModal(false)}
                className="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-surface-2 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-3 bg-surface-2/30 border-b border-border text-xs text-text-muted">
              Choose a friend to start chatting
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-border/60 p-2">
              {friends.length === 0 ? (
                <div className="py-12 px-4 text-center">
                  <Users size={32} className="mx-auto text-text-muted mb-2 opacity-50" />
                  <p className="text-sm font-semibold text-text mb-1">
                    No friends added yet
                  </p>
                  <p className="text-xs text-text-muted mb-4">
                    Add friends first to start a conversation.
                  </p>
                  <button
                    onClick={() => {
                      setShowComposeModal(false)
                      navigate('/friends?tab=add')
                    }}
                    className="px-4 py-2 bg-accent text-white rounded-xl text-xs font-semibold hover:bg-accent/90"
                  >
                    Add Friends
                  </button>
                </div>
              ) : (
                friends.map(friend => {
                  const isStarting = startingChat === friend.id
                  const displayName = friend.display_name || friend.username
                  const initials = displayName.slice(0, 2).toUpperCase()

                  return (
                    <button
                      key={friend.id}
                      onClick={() => handleStartChatWithFriend(friend.id)}
                      disabled={!!startingChat}
                      className="w-full flex items-center justify-between gap-3 p-3 rounded-xl hover:bg-surface-2 text-left transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-accent/15 border border-accent/25 flex items-center justify-center text-accent text-xs font-bold flex-shrink-0">
                          {initials}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-text truncate">
                            {displayName}
                          </div>
                          <div className="text-xs text-text-muted truncate">
                            @{friend.username}
                          </div>
                        </div>
                      </div>

                      {isStarting ? (
                        <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <ChevronRight size={16} className="text-text-muted" />
                      )}
                    </button>
                  )
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

