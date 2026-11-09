import React, { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Users,
  UserPlus,
  Inbox,
  Check,
  X,
  ArrowLeft,
  Copy,
  CheckCircle2,
  AlertCircle,
  UserMinus,
  Ban,
  AtSign,
} from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useFriendsQuery, useFriendRequestsQuery } from '../../hooks/useFriendsQuery'
import { useFriendMutations } from '../../hooks/useFriendMutations'
import { findUserByUsername, type PublicUserProfile } from '../../api/friends'
import { UsernameModal } from '../../components/social/UsernameModal'
import { ConfirmDialog } from '../../components/ConfirmDialog'

type Tab = 'friends' | 'requests' | 'add'

export function FriendsPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { profile } = useAuth()

  const initialTab = (searchParams.get('tab') as Tab) || 'friends'
  const [activeTab, setActiveTab] = useState<Tab>(initialTab)

  const { data: friends = [], isLoading: loadingFriends } = useFriendsQuery()
  const { data: requests = { incoming: [], outgoing: [] } } = useFriendRequestsQuery()
  const { removeFriend, blockUser, respondRequest, cancelRequest, sendRequest } = useFriendMutations()

  // Username modal
  const [usernameModalOpen, setUsernameModalOpen] = useState(false)

  // Search state for Add Tab
  const [searchQuery, setSearchQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchResult, setSearchResult] = useState<PublicUserProfile | null>(null)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [copiedLink, setCopiedLink] = useState(false)

  // Dialog actions
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null)
  const [confirmBlockId, setConfirmBlockId] = useState<string | null>(null)
  const [bannerNotice, setBannerNotice] = useState<string | null>(null)

  const hasUsername = !!profile?.username
  const isOnline = navigator.onLine

  const showNotice = (msg: string) => {
    setBannerNotice(msg)
    setTimeout(() => setBannerNotice(null), 3500)
  }

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab)
    setSearchParams(tab === 'friends' ? {} : { tab })
  }

  // Handle exact username search
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isOnline) {
      setSearchError('Searching requires an internet connection')
      return
    }

    const clean = searchQuery.toLowerCase().replace('@', '').trim()
    if (!clean) return

    setSearching(true)
    setSearchResult(null)
    setSearchError(null)

    try {
      const found = await findUserByUsername(clean)
      if (found) {
        setSearchResult(found)
      } else {
        setSearchError(`No user found with username "@${clean}"`)
      }
    } catch (err: unknown) {
      setSearchError((err as Error)?.message || 'Failed to search for user')
    } finally {
      setSearching(false)
    }
  }

  // Handle Send Request
  const handleSendRequest = async (targetId: string) => {
    if (!hasUsername) {
      setUsernameModalOpen(true)
      return
    }

    try {
      const res = await sendRequest.mutateAsync(targetId)
      if (res.auto_accepted) {
        showNotice('Friend request accepted! You are now friends.')
      } else {
        showNotice('Friend request sent!')
      }
      setSearchResult(null)
      setSearchQuery('')
    } catch (err: unknown) {
      showNotice((err as Error)?.message || 'Failed to send friend request')
    }
  }

  const handleCopyInviteLink = () => {
    if (!profile?.username) {
      setUsernameModalOpen(true)
      return
    }
    const url = `${window.location.origin}/add/${profile.username}`
    navigator.clipboard.writeText(url)
    setCopiedLink(true)
    setTimeout(() => setCopiedLink(false), 2500)
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-xl text-text-muted hover:text-text hover:bg-surface border border-border transition-colors"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-text">Friends & Social</h1>
            <p className="text-xs text-text-muted">
              Connect with friends to share notes and tasks
            </p>
          </div>
        </div>

        {!hasUsername && (
          <button
            onClick={() => setUsernameModalOpen(true)}
            className="px-3 py-1.5 rounded-xl bg-accent/10 border border-accent/20 text-accent text-xs font-medium hover:bg-accent/20 transition-colors flex items-center gap-1.5"
          >
            <AtSign size={13} />
            <span>Set Username</span>
          </button>
        )}
      </div>

      {/* Offline notice */}
      {!isOnline && (
        <div className="p-3 bg-warning/10 border border-warning/30 rounded-xl text-xs text-warning flex items-center gap-2">
          <AlertCircle size={14} className="flex-shrink-0" />
          <span>You are offline. Showing cached friends list. Actions require an internet connection.</span>
        </div>
      )}

      {/* Action notice banner */}
      {bannerNotice && (
        <div className="p-3 bg-accent/10 border border-accent/30 rounded-xl text-xs text-accent flex items-center gap-2 animate-fade-in">
          <CheckCircle2 size={14} className="flex-shrink-0" />
          <span>{bannerNotice}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 p-1 bg-surface border border-border rounded-2xl">
        <button
          onClick={() => handleTabChange('friends')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-medium transition-colors flex items-center justify-center gap-2 ${
            activeTab === 'friends'
              ? 'bg-surface-2 text-text shadow-sm'
              : 'text-text-muted hover:text-text'
          }`}
        >
          <Users size={14} />
          <span>Friends</span>
          <span className="text-[11px] px-1.5 py-0.2 bg-surface rounded-full text-text-secondary border border-border">
            {friends.length}
          </span>
        </button>

        <button
          onClick={() => handleTabChange('requests')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-medium transition-colors flex items-center justify-center gap-2 relative ${
            activeTab === 'requests'
              ? 'bg-surface-2 text-text shadow-sm'
              : 'text-text-muted hover:text-text'
          }`}
        >
          <Inbox size={14} />
          <span>Requests</span>
          {requests.incoming.length > 0 && (
            <span className="w-4 h-4 rounded-full bg-accent text-white text-[10px] font-bold flex items-center justify-center">
              {requests.incoming.length}
            </span>
          )}
        </button>

        <button
          onClick={() => handleTabChange('add')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-medium transition-colors flex items-center justify-center gap-2 ${
            activeTab === 'add'
              ? 'bg-surface-2 text-text shadow-sm'
              : 'text-text-muted hover:text-text'
          }`}
        >
          <UserPlus size={14} />
          <span>Add Friend</span>
        </button>
      </div>

      {/* Tab 1: Friends List */}
      {activeTab === 'friends' && (
        <div className="space-y-3">
          {loadingFriends ? (
            <div className="p-8 text-center text-xs text-text-muted">Loading friends…</div>
          ) : friends.length === 0 ? (
            <div className="p-12 bg-surface border border-border rounded-2xl text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-surface-2 flex items-center justify-center mx-auto text-text-muted">
                <Users size={22} />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-text">No friends connected yet</p>
                <p className="text-xs text-text-muted max-w-xs mx-auto">
                  Add friends by username or share your invite link to collaborate.
                </p>
              </div>
              <button
                onClick={() => handleTabChange('add')}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-accent text-white text-xs font-medium hover:bg-accent/90 transition-colors shadow-sm"
              >
                <UserPlus size={14} />
                <span>Find Someone</span>
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {friends.map(friend => (
                <div
                  key={friend.id}
                  className="p-3.5 bg-surface border border-border rounded-2xl flex items-center justify-between gap-3 hover:border-border/80 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-accent/15 border border-accent/30 flex items-center justify-center text-accent text-sm font-bold flex-shrink-0">
                      {friend.display_name?.slice(0, 2).toUpperCase() || friend.username.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-text truncate">
                        {friend.display_name || friend.username}
                      </div>
                      <div className="text-xs text-text-muted truncate">
                        @{friend.username}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => setConfirmRemoveId(friend.id)}
                      title="Remove friend"
                      className="p-2 rounded-xl text-text-muted hover:text-danger hover:bg-danger/10 transition-colors"
                    >
                      <UserMinus size={15} />
                    </button>
                    <button
                      onClick={() => setConfirmBlockId(friend.id)}
                      title="Block user"
                      className="p-2 rounded-xl text-text-muted hover:text-danger hover:bg-danger/10 transition-colors"
                    >
                      <Ban size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Requests */}
      {activeTab === 'requests' && (
        <div className="space-y-6">
          {/* Incoming */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-text uppercase tracking-wider px-1">
              Incoming Requests ({requests.incoming.length})
            </h3>
            {requests.incoming.length === 0 ? (
              <div className="p-6 bg-surface border border-border rounded-2xl text-center text-xs text-text-muted">
                No incoming friend requests.
              </div>
            ) : (
              requests.incoming.map(req => (
                <div
                  key={req.id}
                  className="p-3.5 bg-surface border border-border rounded-2xl flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-info/15 border border-info/30 flex items-center justify-center text-info text-sm font-bold flex-shrink-0">
                      {req.sender?.display_name?.slice(0, 2).toUpperCase() || req.sender?.username.slice(0, 2).toUpperCase() || 'U'}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-text truncate">
                        {req.sender?.display_name || req.sender?.username}
                      </div>
                      <div className="text-xs text-text-muted">
                        @{req.sender?.username}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => respondRequest.mutate({ requestId: req.id, accept: true })}
                      disabled={respondRequest.isPending}
                      className="p-2 rounded-xl bg-success text-white hover:bg-success/90 transition-colors shadow-sm"
                      title="Accept"
                    >
                      <Check size={14} />
                    </button>
                    <button
                      onClick={() => respondRequest.mutate({ requestId: req.id, accept: false })}
                      disabled={respondRequest.isPending}
                      className="p-2 rounded-xl bg-surface-2 border border-border text-text-muted hover:text-danger transition-colors"
                      title="Decline"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Outgoing */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-text uppercase tracking-wider px-1">
              Sent Requests ({requests.outgoing.length})
            </h3>
            {requests.outgoing.length === 0 ? (
              <div className="p-6 bg-surface border border-border rounded-2xl text-center text-xs text-text-muted">
                No pending sent requests.
              </div>
            ) : (
              requests.outgoing.map(req => (
                <div
                  key={req.id}
                  className="p-3.5 bg-surface border border-border rounded-2xl flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-surface-2 border border-border flex items-center justify-center text-text-muted text-xs font-bold flex-shrink-0">
                      {req.recipient?.username.slice(0, 2).toUpperCase() || 'U'}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-text truncate">
                        @{req.recipient?.username}
                      </div>
                      <div className="text-[11px] text-text-muted">Pending confirmation</div>
                    </div>
                  </div>

                  <button
                    onClick={() => cancelRequest.mutate(req.id)}
                    disabled={cancelRequest.isPending}
                    className="px-2.5 py-1.5 rounded-xl border border-border text-xs text-text-muted hover:text-danger hover:bg-danger/10 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Add Friend */}
      {activeTab === 'add' && (
        <div className="space-y-6">
          {/* Invite Link Card */}
          <div className="p-4 bg-surface border border-border rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-text">Your Invite Link</h3>
                <p className="text-xs text-text-muted">
                  Share your personal link for instant friend requests
                </p>
              </div>
              <button
                onClick={handleCopyInviteLink}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-accent/10 border border-accent/20 text-accent text-xs font-medium hover:bg-accent/20 transition-colors"
              >
                {copiedLink ? <Check size={13} /> : <Copy size={13} />}
                <span>{copiedLink ? 'Copied!' : 'Copy Link'}</span>
              </button>
            </div>
            <div className="text-xs text-text-muted font-mono bg-surface-2 px-3 py-2 rounded-xl border border-border/60 truncate">
              {profile?.username
                ? `${window.location.origin}/add/${profile.username}`
                : 'Set a username to activate your invite link'}
            </div>
          </div>

          {/* Search by exact username */}
          <div className="p-4 bg-surface border border-border rounded-2xl space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-text">Find by Username</h3>
              <p className="text-xs text-text-muted">
                Enter an exact username to send a connection request
              </p>
            </div>

            <form onSubmit={handleSearch} className="space-y-3">
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-text-muted text-sm">@</span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value.toLowerCase())}
                  placeholder="username"
                  className="w-full bg-surface-2 border border-border rounded-xl pl-8 pr-20 py-2 text-sm text-text placeholder:text-text-muted focus:outline-none focus:border-accent"
                />
                <button
                  type="submit"
                  disabled={searching || !searchQuery.trim()}
                  className="absolute right-1.5 top-1.5 px-3 py-1 rounded-lg bg-accent text-white text-xs font-medium hover:bg-accent/90 transition-colors disabled:opacity-50"
                >
                  {searching ? 'Searching…' : 'Find'}
                </button>
              </div>

              {searchError && (
                <div className="p-3 bg-danger/10 border border-danger/30 rounded-xl text-xs text-danger flex items-center gap-2">
                  <AlertCircle size={14} className="flex-shrink-0" />
                  <span>{searchError}</span>
                </div>
              )}
            </form>

            {/* Found user preview */}
            {searchResult && (
              <div className="p-4 bg-surface-2 border border-accent/30 rounded-xl flex items-center justify-between gap-3 animate-fade-in">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-accent/20 border border-accent/40 flex items-center justify-center text-accent text-sm font-bold flex-shrink-0">
                    {searchResult.display_name?.slice(0, 2).toUpperCase() || searchResult.username.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-text truncate">
                      {searchResult.display_name || searchResult.username}
                    </div>
                    <div className="text-xs text-text-muted truncate">
                      @{searchResult.username}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => handleSendRequest(searchResult.id)}
                  disabled={sendRequest.isPending}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-accent text-white text-xs font-medium hover:bg-accent/90 transition-colors shadow-sm disabled:opacity-50 flex-shrink-0"
                >
                  <UserPlus size={14} />
                  <span>Connect</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Username Setup Modal */}
      <UsernameModal
        open={usernameModalOpen}
        onClose={() => setUsernameModalOpen(false)}
        onSuccess={(uname) => showNotice(`Username set to @${uname}!`)}
      />

      {/* Remove Friend Confirmation Dialog */}
      <ConfirmDialog
        open={!!confirmRemoveId}
        title="Remove Friend?"
        message="This will disconnect your friendship. You can always reconnect later by sending a new request."
        confirmLabel="Remove"
        danger
        onConfirm={async () => {
          if (!confirmRemoveId) return
          await removeFriend.mutateAsync(confirmRemoveId)
          setConfirmRemoveId(null)
          showNotice('Friend removed')
        }}
        onCancel={() => setConfirmRemoveId(null)}
      />

      {/* Block User Confirmation Dialog */}
      <ConfirmDialog
        open={!!confirmBlockId}
        title="Block User?"
        message="This user will no longer be able to find you, send you friend requests, or message you. Any existing friendship will be removed."
        confirmLabel="Block"
        danger
        onConfirm={async () => {
          if (!confirmBlockId) return
          await blockUser.mutateAsync(confirmBlockId)
          setConfirmBlockId(null)
          showNotice('User blocked')
        }}
        onCancel={() => setConfirmBlockId(null)}
      />
    </div>
  )
}
