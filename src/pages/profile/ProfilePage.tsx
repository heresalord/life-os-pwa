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
  Camera, Edit2, Check, X, User, Calendar, Flame, CheckSquare,
  Globe, Mail, LogOut, ChevronRight, Shield, Users, Share2, Key,
} from 'lucide-react'
import { redeemShareCode, fetchMySharedItems, type SharedItem } from '../../lib/share'
import clsx from 'clsx'

// ── Image resize helper ─────────────────────────────────────────────────────

async function resizeToDataUrl(file: File, maxPx = 256): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width  = Math.round(img.width  * scale)
      canvas.height = Math.round(img.height * scale)
      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('Canvas unavailable')); return }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/jpeg', 0.82))
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image load failed')) }
    img.src = url
  })
}

// ── helpers ──────────────────────────────────────────────────────────────────

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
    <div className="relative w-20 h-20 mx-auto">
      {/* Avatar circle */}
      <div className="w-20 h-20 rounded-full border-2 border-accent/30 overflow-hidden bg-accent/10 flex items-center justify-center shadow-[var(--shadow-card)]">
        {avatarUrl ? (
          <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
        ) : (
          <span className="text-2xl font-display font-bold text-accent">{initials}</span>
        )}
      </div>

      {/* Camera button overlay */}
      <button
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-accent border-2 border-bg flex items-center justify-center hover:bg-accent-dim transition-colors shadow-lg disabled:opacity-50"
      >
        {uploading ? (
          <div className="w-3 h-3 border-2 border-bg/40 border-t-bg rounded-full animate-spin" />
        ) : (
          <Camera size={14} className="text-bg" />
        )}
      </button>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onUpload(file)
          e.target.value = ''
        }}
      />
    </div>
  )
}

// ── Stat Card ─────────────────────────────────────────────────────────────────

function StatCard({ icon, label, value, color }: {
  icon: React.ReactNode
  label: string
  value: string | number
  color: string
}) {
  return (
    <div className="flex flex-col items-center gap-2 bg-surface border border-border rounded-2xl p-4 text-center">
      <div className={clsx('w-9 h-9 rounded-xl flex items-center justify-center', color)}>
        {icon}
      </div>
      <span className="text-3xl font-display font-bold text-text">{value}</span>
      <span className="text-[10px] text-text-muted uppercase tracking-wider font-medium">{label}</span>
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
  const [sharedItems, setSharedItems] = useState<{ sent: SharedItem[], received: SharedItem[] }>({ sent: [], received: [] })

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

    setRedeeming(true)
    setRedeemError(null)
    setRedeemSuccess(null)

    try {
      const res = await redeemShareCode(shareCode)
      setRedeemSuccess(`Successfully accepted share for ${res.item_type}!`)
      setShareCode('')
      loadSharedItems()
      window.dispatchEvent(new CustomEvent('lifeos-sync-trigger'))
    } catch (err: any) {
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
  const joinDate = user?.created_at
    ? format(parseISO(user.created_at), 'MMMM yyyy')
    : '—'

  // Save display name
  const handleSaveName = async () => {
    if (!user || !displayName.trim()) return
    setSaving(true)
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ display_name: displayName.trim() })
        .eq('id', user.id)
      if (!error) {
        await db.user_profiles.update(user.id, { display_name: displayName.trim() })
        await refreshProfile()
        setEditingName(false)
      }
    } catch (err) {
      console.error('[ProfilePage] save name error:', err)
    } finally {
      setSaving(false)
    }
  }

  // Upload avatar — resize to 256×256 max via canvas, store as base64 data URL
  // directly in user_profiles.avatar_url (no Supabase Storage bucket needed)
  const handleAvatarUpload = async (file: File) => {
    if (!user) return
    setUploading(true)
    try {
      const dataUrl = await resizeToDataUrl(file, 256)
      await supabase.from('user_profiles').update({ avatar_url: dataUrl }).eq('id', user.id)
      await db.user_profiles.update(user.id, { avatar_url: dataUrl })
      setLocalAvatarUrl(dataUrl)
      await refreshProfile()
    } catch (err) {
      console.error('[ProfilePage] avatar upload error:', err)
    } finally {
      setUploading(false)
    }
  }

  const initials = getInitials(profile?.display_name || user?.email, user?.email)
  const avatarUrl = localAvatarUrl || profile?.avatar_url || null

  return (
    <div className="max-w-lg mx-auto space-y-6 pb-12">
      {/* Header */}
      <header>
        <h1 className="text-2xl font-display text-text">Profile</h1>
        <p className="text-sm text-text-muted mt-0.5">Your account and preferences</p>
      </header>

      {/* Avatar + Name Card */}
      <div className="bg-surface border border-border rounded-2xl p-6 shadow-[var(--shadow-card)] space-y-5">
        <AvatarSection
          avatarUrl={avatarUrl}
          initials={initials}
          onUpload={handleAvatarUpload}
          uploading={uploading}
        />

        {/* Display Name */}
        <div className="text-center space-y-1">
          {editingName ? (
            <div className="flex items-center gap-2 justify-center">
              <input
                autoFocus
                type="text"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleSaveName()
                  if (e.key === 'Escape') setEditingName(false)
                }}
                className="bg-surface-2 border border-accent rounded-xl px-3 py-2 text-sm text-text focus:outline-none text-center w-48"
                placeholder="Your name"
              />
              <button
                onClick={handleSaveName}
                disabled={saving}
                className="p-2 rounded-lg bg-accent/10 text-accent hover:bg-accent/20 transition-colors"
              >
                {saving
                  ? <div className="w-3 h-3 border-2 border-accent/40 border-t-accent rounded-full animate-spin" />
                  : <Check size={14} />
                }
              </button>
              <button
                onClick={() => setEditingName(false)}
                className="p-2 rounded-lg text-text-muted hover:text-text hover:bg-surface-2 transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setEditingName(true)}
              className="group flex items-center gap-2 justify-center mx-auto"
            >
              <span className="text-2xl font-display font-semibold text-text">
                {profile?.display_name || user?.email?.split('@')[0] || 'User'}
              </span>
              <Edit2 size={13} className="text-text-muted group-hover:text-accent transition-colors" />
            </button>
          )}
          <p className="text-xs text-text-muted flex items-center justify-center gap-2">
            <Mail size={11} />
            {user?.email}
          </p>
          <p className="text-xs text-text-muted flex items-center justify-center gap-2">
            <Calendar size={11} />
            Member since {joinDate}
          </p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard
          icon={<Flame size={18} className="text-warning" />}
          label="Best Streak"
          value={bestStreak}
          color="bg-warning/10"
        />
        <StatCard
          icon={<CheckSquare size={18} className="text-success" />}
          label="Today Done"
          value={completedTasksToday}
          color="bg-success/10"
        />
        <StatCard
          icon={<User size={18} className="text-accent" />}
          label="Goals"
          value={goalsAll.length}
          color="bg-accent/10"
        />
      </div>

      {/* Collaborative Sharing */}
      <div className="bg-surface border border-border rounded-2xl p-5 shadow-[var(--shadow-card)] space-y-4 text-left">
        <h3 className="text-sm font-bold text-text flex items-center gap-2">
          <Share2 size={16} className="text-accent" />
          Collaborative Sharing
        </h3>
        
        {/* Redeem Code Form */}
        <form onSubmit={handleRedeemCode} className="space-y-3">
          <div>
            <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-1">
              Redeem Invite / Share Code
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="SHARE-XXXXXX"
                value={shareCode}
                onChange={(e) => setShareCode(e.target.value)}
                className="flex-1 bg-surface-2 border border-border focus:border-accent rounded-xl px-3 py-2 text-sm text-text focus:outline-none transition-colors"
              />
              <button
                type="submit"
                disabled={redeeming || !shareCode.trim()}
                className="px-4 py-2 bg-accent text-bg font-semibold rounded-xl text-xs hover:bg-accent-dim transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {redeeming ? (
                  <div className="w-3.5 h-3.5 border-2 border-bg/40 border-t-bg rounded-full animate-spin" />
                ) : (
                  <>
                    <Key size={13} />
                    Redeem
                  </>
                )}
              </button>
            </div>
          </div>

          {redeemSuccess && (
            <p className="text-xs text-success font-medium">{redeemSuccess}</p>
          )}
          {redeemError && (
            <p className="text-xs text-danger font-medium">{redeemError}</p>
          )}
        </form>

        {/* List of Shared Items */}
        {(sharedItems.sent.length > 0 || sharedItems.received.length > 0) && (
          <div className="space-y-3.5 pt-2 border-t border-border/60">
            <h4 className="text-xs font-bold text-text flex items-center gap-2">
              <Users size={14} className="text-text-muted" />
              Active Collaborations
            </h4>
            
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {sharedItems.received.map(item => (
                <div key={item.id} className="flex items-center justify-between text-xs p-2.5 bg-surface-2 border border-border rounded-xl">
                  <div>
                    <span className="font-semibold text-text capitalize">{item.item_type}</span> share received from
                    <span className="block text-[10px] text-text-muted mt-0.5 font-medium">{item.shared_with_email}</span>
                  </div>
                  <span className="text-[10px] bg-success/10 text-success border border-success/20 px-2 py-0.5 rounded-full font-bold">
                    Active
                  </span>
                </div>
              ))}
              {sharedItems.sent.map(item => (
                <div key={item.id} className="flex items-center justify-between text-xs p-2.5 bg-surface-2 border border-border rounded-xl">
                  <div>
                    <span className="font-semibold text-text capitalize">{item.item_type}</span> shared by you with
                    <span className="block text-[10px] text-text-muted mt-0.5 font-medium">{item.shared_with_email}</span>
                  </div>
                  <span className={clsx(
                    'text-[10px] border px-2 py-0.5 rounded-full font-bold',
                    item.status === 'accepted'
                      ? 'bg-success/10 text-success border-success/20'
                      : 'bg-warning/10 text-warning border-warning/20'
                  )}>
                    {item.status === 'accepted' ? 'Accepted' : 'Pending'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Info Rows */}
      <div className="bg-surface border border-border rounded-2xl shadow-[var(--shadow-card)] overflow-hidden divide-y divide-border/60">
        {/* Email row */}
        <div className="flex items-center gap-3 px-4 py-3.5">
          <div className="w-8 h-8 rounded-lg bg-surface-2 flex items-center justify-center">
            <Mail size={15} className="text-text-muted" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-text-muted">Email</p>
            <p className="text-sm text-text truncate">{user?.email}</p>
          </div>
        </div>

        {/* Timezone row */}
        <div className="flex items-center gap-3 px-4 py-3.5">
          <div className="w-8 h-8 rounded-lg bg-surface-2 flex items-center justify-center">
            <Globe size={15} className="text-text-muted" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-text-muted">Timezone</p>
            <p className="text-sm text-text truncate">{timezone}</p>
          </div>
        </div>

        {/* Auth provider */}
        <div className="flex items-center gap-3 px-4 py-3.5">
          <div className="w-8 h-8 rounded-lg bg-surface-2 flex items-center justify-center">
            <Shield size={15} className="text-text-muted" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-text-muted">Authentication</p>
            <p className="text-sm text-text capitalize">
              {user?.app_metadata?.provider ?? 'Email'}
            </p>
          </div>
        </div>

        {/* Settings link */}
        <a
          href="/settings"
          className="flex items-center gap-3 px-4 py-3.5 hover:bg-surface-2/50 transition-colors"
        >
          <div className="w-8 h-8 rounded-lg bg-surface-2 flex items-center justify-center">
            <Globe size={15} className="text-text-muted" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-text">Settings</p>
            <p className="text-xs text-text-muted">Theme, language, notifications</p>
          </div>
          <ChevronRight size={16} className="text-text-muted" />
        </a>
      </div>

      {/* Sign Out */}
      <button
        onClick={signOut}
        className="w-full flex items-center justify-center gap-2 py-3.5 bg-surface border border-border rounded-2xl text-sm font-medium text-danger hover:bg-danger/5 hover:border-danger/30 transition-all shadow-sm"
      >
        <LogOut size={15} />
        Sign Out
      </button>
    </div>
  )
}
