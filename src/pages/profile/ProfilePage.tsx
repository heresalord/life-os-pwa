import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useGoalsQuery } from '../../hooks/useGoalsQuery'
import { useTasksQuery } from '../../hooks/useTasksQuery'
import { supabase } from '../../lib/supabase'
import { useDb } from '../../db/DbContext'
import { getUserLocalDate } from '../../lib/dateUtils'
import { useAppStore } from '../../store/useAppStore'
import { format, parseISO } from 'date-fns'
import {
  Camera,
  Edit2,
  Check,
  X,
  Calendar,
  Flame,
  CheckSquare,
  Globe,
  Mail,
  LogOut,
  ChevronRight,
  Shield,
  Users,
  Share2,
  Key,
  Target,
  Settings,
} from 'lucide-react'
import { redeemShareCode, fetchMySharedItems, type SharedItem } from '../../lib/share'
import { RecoveryKeyModal } from '../../components/auth/RecoveryKeyModal'
import { useRecoveryKeyStatus } from '../../hooks/useRecoveryKeyStatus'
import { haptic } from '../../lib/haptic'
import clsx from 'clsx'

// ── Image resize helper ─────────────────────────────────────────────────────

async function resizeToDataUrl(file: File, maxPx = 256): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Canvas unavailable'))
        return
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/jpeg', 0.82))
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Image load failed'))
    }
    img.src = url
  })
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name: string | null | undefined, email: string | null | undefined): string {
  if (name) {
    const parts = name.trim().split(/\s+/)
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
    return parts[0].slice(0, 2).toUpperCase()
  }
  if (email) return email.slice(0, 2).toUpperCase()
  return '??'
}

// ── Avatar Component ─────────────────────────────────────────────────────────

function AvatarSection({
  avatarUrl,
  initials,
  onUpload,
  uploading,
}: {
  avatarUrl: string | null
  initials: string
  onUpload: (file: File) => void
  uploading: boolean
}) {
  const fileRef = useRef<HTMLInputElement>(null)

  return (
    <div className="relative w-24 h-24 mx-auto group">
      {/* Avatar circle with glow ring */}
      <div className="w-24 h-24 rounded-full border-2 border-accent/40 overflow-hidden bg-surface-2 flex items-center justify-center shadow-md transition-transform duration-200 group-hover:scale-[1.02]">
        {avatarUrl ? (
          <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
        ) : (
          <span className="text-3xl font-display font-bold text-accent tracking-wide">{initials}</span>
        )}
      </div>

      {/* Camera button overlay */}
      <button
        type="button"
        onClick={() => {
          haptic('light')
          fileRef.current?.click()
        }}
        disabled={uploading}
        className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-accent border-2 border-surface flex items-center justify-center hover:bg-accent-dim active:scale-95 transition-all shadow-md disabled:opacity-50 cursor-pointer"
        aria-label="Change profile photo"
      >
        {uploading ? (
          <div className="w-3.5 h-3.5 border-2 border-bg/40 border-t-bg rounded-full animate-spin" />
        ) : (
          <Camera size={14} className="text-bg" />
        )}
      </button>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0]
          if (file) onUpload(file)
          e.target.value = ''
        }}
      />
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export function ProfilePage() {
  const db = useDb()
  const { user, profile, refreshProfile, signOut } = useAuth()
  const { timezone } = useAppStore()
  const today = getUserLocalDate(timezone)

  // Display name editing
  const [editingName, setEditingName] = useState(false)
  const [displayName, setDisplayName] = useState('')
  const [saving, setSaving] = useState(false)

  // Avatar upload
  const [uploading, setUploading] = useState(false)
  const [localAvatarUrl, setLocalAvatarUrl] = useState<string | null>(null)

  // Populate display name from profile
  useEffect(() => {
    if (profile?.display_name) setDisplayName(profile.display_name)
    if (profile?.avatar_url) setLocalAvatarUrl(profile.avatar_url)
  }, [profile])

  // Sharing States
  const [shareCode, setShareCode] = useState('')
  const [redeeming, setRedeeming] = useState(false)
  const [redeemSuccess, setRedeemSuccess] = useState<string | null>(null)
  const [redeemError, setRedeemError] = useState<string | null>(null)
  const [sharedItems, setSharedItems] = useState<{ sent: SharedItem[]; received: SharedItem[] }>({
    sent: [],
    received: [],
  })

  const loadSharedItems = async () => {
    try {
      const data = await fetchMySharedItems()
      setSharedItems(data)
    } catch (err) {
      console.error('Failed to load shared items:', err)
    }
  }

  useEffect(() => {
    if (user) {
      loadSharedItems()
    }
  }, [user])

  const handleRedeemCode = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!shareCode.trim()) return

    haptic('light')
    setRedeeming(true)
    setRedeemError(null)
    setRedeemSuccess(null)

    try {
      const res = await redeemShareCode(shareCode)
      haptic('success')
      setRedeemSuccess(`Successfully accepted share for ${res.item_type}!`)
      setShareCode('')
      loadSharedItems()
      window.dispatchEvent(new CustomEvent('lifeos-sync-trigger'))
    } catch (err: any) {
      haptic('error')
      setRedeemError(err.message || 'Failed to redeem share code. Please verify the code.')
    } finally {
      setRedeeming(false)
    }
  }

  // Stats queries
  const { data: goalsAll = [] } = useGoalsQuery('active')
  const { data: tasks = [] } = useTasksQuery(today)

  // Calculate stats
  const habitGoals = goalsAll.filter(g => g.tracker_type === 'habit')
  const bestStreak = habitGoals.reduce((max, g) => Math.max(max, g.habit_streak ?? 0), 0)
  const completedTasksToday = tasks.filter(t => t.completed).length

  // Join date
  const joinDate = user?.created_at ? format(parseISO(user.created_at), 'MMMM yyyy') : '—'

  const { isVerified: isRecoveryVerified, refreshStatus: refreshRecoveryStatus } =
    useRecoveryKeyStatus()
  const [showRecoveryModal, setShowRecoveryModal] = useState(false)

  // Save display name
  const handleSaveName = async () => {
    if (!user || !displayName.trim()) return
    haptic('light')
    setSaving(true)
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ display_name: displayName.trim() })
        .eq('id', user.id)
      if (!error) {
        await db.user_profiles.update(user.id, { display_name: displayName.trim() })
        await refreshProfile()
        haptic('success')
        setEditingName(false)
      }
    } catch (err) {
      console.error('[ProfilePage] save name error:', err)
      haptic('error')
    } finally {
      setSaving(false)
    }
  }

  // Upload avatar
  const handleAvatarUpload = async (file: File) => {
    if (!user) return
    setUploading(true)
    try {
      const dataUrl = await resizeToDataUrl(file, 256)
      await supabase.from('user_profiles').update({ avatar_url: dataUrl }).eq('id', user.id)
      await db.user_profiles.update(user.id, { avatar_url: dataUrl })
      setLocalAvatarUrl(dataUrl)
      await refreshProfile()
      haptic('success')
    } catch (err) {
      console.error('[ProfilePage] avatar upload error:', err)
      haptic('error')
    } finally {
      setUploading(false)
    }
  }

  const initials = getInitials(profile?.display_name || user?.email, user?.email)
  const avatarUrl = localAvatarUrl || profile?.avatar_url || null

  return (
    <div className="max-w-xl mx-auto space-y-7 pb-16 px-4 sm:px-0">
      {/* Header */}
      <header className="pt-2">
        <h1 className="text-2xl sm:text-3xl font-display font-bold text-text tracking-tight">
          Profile
        </h1>
        <p className="text-xs sm:text-sm text-text-muted mt-0.5">Your identity & account settings</p>
      </header>

      {/* Hero Profile Card */}
      <div className="relative overflow-hidden bg-gradient-to-b from-surface via-surface to-surface border border-border/80 rounded-3xl p-6 sm:p-7 shadow-xs">
        {/* Subtle decorative background accent */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-16 left-1/2 -translate-x-1/2 w-48 h-32 rounded-full blur-2xl opacity-20 bg-accent"
        />

        <div className="relative z-10 flex flex-col items-center text-center space-y-4">
          <AvatarSection
            avatarUrl={avatarUrl}
            initials={initials}
            onUpload={handleAvatarUpload}
            uploading={uploading}
          />

          {/* Name & Title */}
          <div className="space-y-1 w-full flex flex-col items-center">
            {editingName ? (
              <div className="flex items-center gap-2 justify-center w-full max-w-xs">
                <input
                  autoFocus
                  type="text"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleSaveName()
                    if (e.key === 'Escape') setEditingName(false)
                  }}
                  className="bg-surface-2 border border-accent rounded-xl px-3.5 py-1.5 text-base font-semibold text-text focus:outline-none text-center flex-1"
                  placeholder="Your display name"
                />
                <button
                  type="button"
                  onClick={handleSaveName}
                  disabled={saving}
                  className="p-2 rounded-xl bg-accent text-bg hover:bg-accent-dim active:scale-95 transition-all cursor-pointer"
                >
                  {saving ? (
                    <div className="w-4 h-4 border-2 border-bg/40 border-t-bg rounded-full animate-spin" />
                  ) : (
                    <Check size={16} strokeWidth={2.5} />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingName(false)}
                  className="p-2 rounded-xl text-text-muted hover:text-text hover:bg-surface-2 active:scale-95 transition-all cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  haptic('light')
                  setEditingName(true)
                }}
                className="group inline-flex items-center gap-2 px-3 py-1 rounded-xl hover:bg-surface-2/60 transition-all cursor-pointer"
              >
                <span className="text-xl sm:text-2xl font-display font-bold text-text">
                  {profile?.display_name || user?.email?.split('@')[0] || 'User'}
                </span>
                <Edit2
                  size={14}
                  className="text-text-muted opacity-60 group-hover:opacity-100 group-hover:text-accent transition-all"
                />
              </button>
            )}

            <div className="flex flex-wrap items-center justify-center gap-2 pt-1 text-xs text-text-muted">
              <span className="inline-flex items-center gap-1 bg-surface-2 px-2.5 py-0.5 rounded-full border border-border/60">
                <Mail size={11} className="text-accent" />
                <span className="font-medium text-text-secondary">{user?.email}</span>
              </span>
              <span className="inline-flex items-center gap-1 bg-surface-2 px-2.5 py-0.5 rounded-full border border-border/60">
                <Calendar size={11} className="text-accent" />
                <span>Joined {joinDate}</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Unified iOS Stats Strip */}
      <div>
        <div className="flex items-center justify-between px-1 mb-2">
          <span className="text-[11px] font-bold tracking-wider uppercase text-text-muted">
            Activity Overview
          </span>
        </div>
        <div className="grid grid-cols-3 bg-surface border border-border/80 rounded-2xl p-3 shadow-xs divide-x divide-border/60">
          <div className="flex flex-col items-center justify-center text-center px-2 py-1">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center mb-1 text-amber-500">
              <Flame size={16} strokeWidth={2.2} />
            </div>
            <span className="text-2xl font-display font-bold text-text leading-tight">
              {bestStreak}
            </span>
            <span className="text-[10px] text-text-muted uppercase tracking-wider font-semibold mt-0.5">
              Best Streak
            </span>
          </div>

          <div className="flex flex-col items-center justify-center text-center px-2 py-1">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-1 text-emerald-500">
              <CheckSquare size={16} strokeWidth={2.2} />
            </div>
            <span className="text-2xl font-display font-bold text-text leading-tight">
              {completedTasksToday}
            </span>
            <span className="text-[10px] text-text-muted uppercase tracking-wider font-semibold mt-0.5">
              Today Done
            </span>
          </div>

          <div className="flex flex-col items-center justify-center text-center px-2 py-1">
            <div className="w-8 h-8 rounded-xl bg-accent/15 flex items-center justify-center mb-1 text-accent">
              <Target size={16} strokeWidth={2.2} />
            </div>
            <span className="text-2xl font-display font-bold text-text leading-tight">
              {goalsAll.length}
            </span>
            <span className="text-[10px] text-text-muted uppercase tracking-wider font-semibold mt-0.5">
              Active Goals
            </span>
          </div>
        </div>
      </div>

      {/* iOS Grouped Section: ACCOUNT DETAILS */}
      <div className="space-y-2">
        <span className="px-1 text-[11px] font-bold tracking-wider uppercase text-text-muted">
          Account Details
        </span>
        <div className="bg-surface border border-border/80 rounded-2xl overflow-hidden divide-y divide-border/60 shadow-xs">
          {/* Email row */}
          <div className="flex items-center gap-3.5 px-4 py-3.5">
            <div className="w-8 h-8 rounded-xl bg-surface-2 flex items-center justify-center shrink-0">
              <Mail size={15} className="text-accent" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-text-muted">Primary Email</p>
              <p className="text-sm font-medium text-text truncate">{user?.email}</p>
            </div>
          </div>

          {/* Timezone row */}
          <div className="flex items-center gap-3.5 px-4 py-3.5">
            <div className="w-8 h-8 rounded-xl bg-surface-2 flex items-center justify-center shrink-0">
              <Globe size={15} className="text-accent" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-text-muted">Detected Timezone</p>
              <p className="text-sm font-medium text-text truncate">{timezone}</p>
            </div>
          </div>

          {/* Auth provider */}
          <div className="flex items-center gap-3.5 px-4 py-3.5">
            <div className="w-8 h-8 rounded-xl bg-surface-2 flex items-center justify-center shrink-0">
              <Shield size={15} className="text-accent" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-text-muted">Authentication Method</p>
              <p className="text-sm font-medium text-text capitalize">
                {user?.app_metadata?.provider ?? 'Email & Password'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* iOS Grouped Section: SECURITY */}
      <div className="space-y-2">
        <span className="px-1 text-[11px] font-bold tracking-wider uppercase text-text-muted">
          Security & Access
        </span>
        <div className="bg-surface border border-border/80 rounded-2xl overflow-hidden divide-y divide-border/60 shadow-xs">
          {/* Master Recovery Key row */}
          <div
            onClick={() => {
              haptic('light')
              setShowRecoveryModal(true)
            }}
            className="flex items-center gap-3.5 px-4 py-3.5 hover:bg-surface-2/60 active:bg-surface-2 transition-colors cursor-pointer"
          >
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
              <Key size={15} className="text-amber-500" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-text">Master Recovery Key</p>
                <span
                  className={clsx(
                    'text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border',
                    isRecoveryVerified
                      ? 'bg-success/10 text-success border-success/20'
                      : 'bg-warning/10 text-warning border-warning/20 animate-pulse'
                  )}
                >
                  {isRecoveryVerified ? 'Verified' : 'Action Required'}
                </span>
              </div>
              <p className="text-xs text-text-muted">12-word zero-email account restore phrase</p>
            </div>
            <ChevronRight size={16} className="text-text-muted shrink-0" />
          </div>

          {/* Quick Settings link */}
          <a
            href="/settings"
            onClick={() => haptic('light')}
            className="flex items-center gap-3.5 px-4 py-3.5 hover:bg-surface-2/60 active:bg-surface-2 transition-colors cursor-pointer"
          >
            <div className="w-8 h-8 rounded-xl bg-surface-2 flex items-center justify-center shrink-0">
              <Settings size={15} className="text-text-muted" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-text">App Settings</p>
              <p className="text-xs text-text-muted">Preferences, theme, notifications, finance</p>
            </div>
            <ChevronRight size={16} className="text-text-muted shrink-0" />
          </a>
        </div>
      </div>

      {/* iOS Grouped Section: COLLABORATIVE SHARING */}
      <div className="space-y-2">
        <span className="px-1 text-[11px] font-bold tracking-wider uppercase text-text-muted">
          Collaboration
        </span>
        <div className="bg-surface border border-border/80 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4 text-left">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-accent/15 flex items-center justify-center text-accent">
              <Share2 size={16} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-text">Collaborative Sharing</h3>
              <p className="text-xs text-text-muted">Accept invites or review shared goals & lists</p>
            </div>
          </div>

          {/* Redeem Code Form */}
          <form onSubmit={handleRedeemCode} className="space-y-2.5">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="SHARE-XXXXXX"
                value={shareCode}
                onChange={e => setShareCode(e.target.value)}
                className="flex-1 bg-surface-2 border border-border/80 focus:border-accent focus:bg-surface rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-mono text-text focus:outline-none transition-all"
              />
              <button
                type="submit"
                disabled={redeeming || !shareCode.trim()}
                className="px-4 py-2.5 bg-accent text-bg font-semibold rounded-xl text-xs hover:bg-accent-dim active:scale-95 transition-all disabled:opacity-50 flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                {redeeming ? (
                  <div className="w-3.5 h-3.5 border-2 border-bg/40 border-t-bg rounded-full animate-spin" />
                ) : (
                  <>
                    <Key size={13} />
                    <span>Redeem</span>
                  </>
                )}
              </button>
            </div>

            {redeemSuccess && (
              <p className="text-xs text-success font-medium bg-success/10 border border-success/20 rounded-xl p-2.5">
                {redeemSuccess}
              </p>
            )}
            {redeemError && (
              <p className="text-xs text-danger font-medium bg-danger/10 border border-danger/20 rounded-xl p-2.5">
                {redeemError}
              </p>
            )}
          </form>

          {/* List of Shared Items */}
          {(sharedItems.sent.length > 0 || sharedItems.received.length > 0) && (
            <div className="space-y-3 pt-3 border-t border-border/60">
              <h4 className="text-xs font-bold text-text flex items-center gap-1.5">
                <Users size={13} className="text-text-muted" />
                <span>Active Collaborations</span>
              </h4>

              <div className="space-y-2 max-h-48 overflow-y-auto">
                {sharedItems.received.map(item => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between text-xs p-3 bg-surface-2/80 border border-border/70 rounded-xl"
                  >
                    <div>
                      <span className="font-semibold text-text capitalize">{item.item_type}</span>{' '}
                      received from
                      <span className="block text-[10px] text-text-muted mt-0.5 font-medium">
                        {item.shared_with_email}
                      </span>
                    </div>
                    <span className="text-[10px] bg-success/10 text-success border border-success/20 px-2 py-0.5 rounded-full font-bold">
                      Active
                    </span>
                  </div>
                ))}
                {sharedItems.sent.map(item => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between text-xs p-3 bg-surface-2/80 border border-border/70 rounded-xl"
                  >
                    <div>
                      <span className="font-semibold text-text capitalize">{item.item_type}</span>{' '}
                      shared with
                      <span className="block text-[10px] text-text-muted mt-0.5 font-medium">
                        {item.shared_with_email}
                      </span>
                    </div>
                    <span
                      className={clsx(
                        'text-[10px] border px-2 py-0.5 rounded-full font-bold',
                        item.status === 'accepted'
                          ? 'bg-success/10 text-success border-success/20'
                          : 'bg-warning/10 text-warning border-warning/20'
                      )}
                    >
                      {item.status === 'accepted' ? 'Accepted' : 'Pending'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sign Out Action Button */}
      <div className="pt-2">
        <button
          type="button"
          onClick={() => {
            haptic('error')
            signOut()
          }}
          className="w-full flex items-center justify-center gap-2 py-3.5 bg-danger/10 text-danger border border-danger/25 rounded-2xl text-sm font-semibold hover:bg-danger/15 active:scale-[0.99] transition-all cursor-pointer shadow-xs"
        >
          <LogOut size={16} strokeWidth={2.2} />
          <span>Sign Out</span>
        </button>
      </div>

      {user && (
        <RecoveryKeyModal
          userId={user.id}
          email={user.email || ''}
          open={showRecoveryModal}
          onOpenChange={setShowRecoveryModal}
          onVerified={refreshRecoveryStatus}
        />
      )}
    </div>
  )
}

