import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useUserSettings } from '../../hooks/useUserSettings'
import { exportAllDataToJson, exportTableCSV } from '../../lib/exportUtils'
import { useDb } from '../../db/DbContext'
import { useAppStore } from '../../store/useAppStore'
import { ALL_NAV_OPTIONS } from '../../lib/constants'
import { useTranslation } from '../../i18n'
import { haptic } from '../../lib/haptic'
import {
  User,
  Palette,
  Bell,
  DollarSign,
  Database,
  LogOut,
  Download,
  Upload,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader,
  Moon,
  Sun,
  X,
  Plus,
  Check,
  CalendarCheck,
  Flame,
  Wallet,
  PartyPopper,
  PiggyBank,
  BarChart3,
  Globe,
  ShieldCheck,
  Key,
} from 'lucide-react'
import { ACCENT_PRESETS, type AccentPreset } from '../../lib/colorUtils'
import {
  pushSupported,
  isPushSubscribed,
  subscribeToPush,
  unsubscribeFromPush,
} from '../../lib/pushNotifications'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { RecoveryKeyModal } from '../../components/auth/RecoveryKeyModal'
import { useRecoveryKeyStatus } from '../../hooks/useRecoveryKeyStatus'
import clsx from 'clsx'

// ── iOS Toggle Component ───────────────────────────────────────────────────────
const Toggle = ({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
}) => {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => {
        haptic('light')
        onChange(!checked)
      }}
      className={clsx(
        'w-11 h-6 rounded-full p-0.5 transition-colors focus:outline-none relative inline-flex items-center flex-shrink-0 disabled:opacity-50 cursor-pointer',
        checked ? 'bg-success' : 'bg-surface-2 border border-border/80'
      )}
    >
      <span
        className={clsx(
          'w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 ease-out transform',
          checked ? 'translate-x-5' : 'translate-x-0'
        )}
      />
    </button>
  )
}

const supabaseAny = supabase as any
type AnyRow = Record<string, unknown>

const PUSH_ERROR_MESSAGES: Record<string, string> = {
  no_vapid_key: 'Push notifications are not configured for this app.',
  no_sw_support: 'Your browser does not support push notifications.',
  permission_denied: 'Notification permission was denied. Enable it in your browser settings.',
  sw_failed: 'Failed to register the service worker. Try refreshing.',
  unknown: 'Something went wrong enabling notifications.',
}

const TABLES = [
  'daily_records',
  'tasks',
  'transactions',
  'goals',
  'goal_events',
  'books',
  'quotes',
  'agenda_blocks',
  'inbox_items',
  'notes',
]

function transformPayload(raw: any, userId: string): Record<string, AnyRow[]> {
  const isNewFormat = raw.schema_version === 1 && raw.data
  const source = isNewFormat ? raw.data : raw
  const now = new Date().toISOString()
  const mapUser = (rows: AnyRow[]) => rows.map(r => ({ ...r, user_id: userId }))
  return {
    tasks: (source.tasks ?? []).map((r: AnyRow) => ({
      id: r.id,
      user_id: userId,
      date: r.date,
      title: r.title,
      completed: r.completed ?? false,
      skipped: r.skipped ?? false,
      priority: r.priority ?? null,
      completed_at: r.completed_at ?? null,
      skipped_at: r.skipped_at ?? null,
      carried_from: r.carried_from ?? null,
      from_inbox_id: r.from_inbox_id ?? null,
      created_at: r.created_at ?? now,
    })),
    notes: (source.notes ?? []).map((r: AnyRow) => ({
      id: r.id,
      user_id: userId,
      date: r.date,
      title: r.title ?? 'Note',
      content: r.content ?? '',
      template:
        r.template === 'free' || r.template === 'freewrite'
          ? null
          : r.template === 'morning'
            ? 'morning'
            : r.template === 'night'
              ? 'night'
              : null,
      created_at: r.created_at ?? now,
      updated_at: r.updated_at ?? now,
    })),
    agenda_blocks: (source.agenda_blocks ?? []).map((r: AnyRow) => ({
      id: r.id,
      user_id: userId,
      date: r.date,
      start_time: r.start_time,
      end_time: r.end_time,
      description: (r.description ?? r.title ?? 'Block') as string,
      created_at: r.created_at ?? now,
    })),
    goals: (source.goals ?? []).map((r: AnyRow) => ({
      id: r.id,
      user_id: userId,
      name: r.name,
      goal_type: (r.goal_type as string) ?? 'general',
      measurement_type: (r.measurement_type as string) ?? 'count',
      target: r.target ?? null,
      currency: r.currency ?? null,
      start_date: r.start_date ?? null,
      end_date: r.end_date ?? null,
      state: (r.state as string) ?? 'active',
      is_completed: r.is_completed ?? false,
      sub_goals: r.sub_goals ?? [],
      created_at: r.created_at ?? now,
      updated_at: r.updated_at ?? now,
    })),
    daily_records: (source.daily_records ?? []).map((r: AnyRow) => ({
      id: r.id,
      user_id: userId,
      date: r.date,
      mood: r.mood ?? null,
      intent: r.intent ?? null,
      reflections: r.reflections ?? {},
      energy_am: r.energy_am ?? null,
      energy_pm: r.energy_pm ?? null,
      gratitude: r.gratitude ?? [],
      win_of_day: r.win_of_day ?? null,
      went_well: r.went_well ?? null,
      do_differently: r.do_differently ?? null,
      tomorrow_focus: r.tomorrow_focus ?? null,
      morning_complete: r.morning_complete ?? false,
      evening_complete: r.evening_complete ?? false,
      day_score: r.day_score ?? 0,
      journal: r.journal ?? null,
      created_at: r.created_at ?? r.updated_at ?? now,
      updated_at: r.updated_at ?? now,
    })),
    transactions: mapUser(source.transactions ?? []),
    goal_events: mapUser(source.goal_events ?? []),
    books: mapUser(source.books ?? []),
    quotes: mapUser(source.quotes ?? []),
    inbox_items: (source.inbox_items ?? []).map((r: AnyRow) => ({
      id: r.id,
      user_id: userId,
      text: r.text,
      type: r.type ?? 'thought',
      processed: r.processed ?? false,
      processed_at: r.processed_at ?? null,
      processed_to: r.processed_to ?? null,
      archived_at: r.archived_at ?? null,
      captured_at: r.captured_at ?? now,
    })),
  }
}

// ── Category Editor ─────────────────────────────────────────────────────────
function CategoryEditor({
  label,
  categories,
  onChange,
}: {
  label: string
  categories: string[]
  onChange: (cats: string[]) => void
}) {
  const [input, setInput] = useState('')
  const add = () => {
    const val = input.trim().toLowerCase()
    if (!val || categories.includes(val)) return
    haptic('light')
    onChange([...categories, val])
    setInput('')
  }
  const remove = (cat: string) => {
    haptic('light')
    onChange(categories.filter(c => c !== cat))
  }
  return (
    <div className="space-y-2.5">
      <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wider">
        {label}
      </label>
      <div className="flex flex-wrap gap-1.5 min-h-[36px]">
        {categories.map(cat => (
          <span
            key={cat}
            className="inline-flex items-center gap-1.5 px-3 py-1 bg-surface-2 border border-border/80 rounded-full text-xs font-medium text-text capitalize shadow-2xs"
          >
            {cat}
            <button
              type="button"
              onClick={() => remove(cat)}
              className="text-text-muted hover:text-danger active:scale-90 transition-all cursor-pointer"
            >
              <X size={12} />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2 pt-1">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), add())}
          placeholder="New category…"
          className="flex-1 bg-surface-2 border border-border/80 focus:border-accent focus:bg-surface rounded-xl px-3.5 py-2 text-xs sm:text-sm text-text placeholder-text-muted focus:outline-none transition-all"
        />
        <button
          type="button"
          onClick={add}
          className="px-3 py-2 bg-accent/15 text-accent font-semibold rounded-xl hover:bg-accent/25 active:scale-95 transition-all cursor-pointer flex items-center gap-1 text-xs"
        >
          <Plus size={15} />
          <span>Add</span>
        </button>
      </div>
    </div>
  )
}

// ── Tab Types ───────────────────────────────────────────────────────────────
type Tab = 'profile' | 'appearance' | 'notifications' | 'finance' | 'data'

const TABS: { id: Tab; label: string; icon: React.FC<any> }[] = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'notifications', label: 'Alerts', icon: Bell },
  { id: 'finance', label: 'Finance', icon: DollarSign },
  { id: 'data', label: 'Data', icon: Database },
]

// ── Section Helpers ─────────────────────────────────────────────────────────
const SettingRow = ({
  icon: Icon,
  iconBg = 'bg-accent/10',
  iconColor = 'text-accent',
  label,
  sub,
  children,
  onClick,
}: {
  icon?: React.FC<any>
  iconBg?: string
  iconColor?: string
  label: string
  sub?: string
  children?: React.ReactNode
  onClick?: () => void
}) => (
  <div
    onClick={onClick}
    className={clsx(
      'flex items-center justify-between gap-3.5 px-4 py-3.5 transition-colors',
      onClick ? 'hover:bg-surface-2/60 active:bg-surface-2 cursor-pointer' : ''
    )}
  >
    <div className="flex items-center gap-3.5 min-w-0 flex-1">
      {Icon && (
        <div
          className={clsx(
            'w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-2xs',
            iconBg,
            iconColor
          )}
        >
          <Icon size={16} strokeWidth={2} />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-text truncate">{label}</p>
        {sub && <p className="text-xs text-text-muted mt-0.5 leading-relaxed truncate">{sub}</p>}
      </div>
    </div>
    {children && <div className="shrink-0">{children}</div>}
  </div>
)

const SectionGroup = ({
  title,
  children,
}: {
  title?: string
  children: React.ReactNode
}) => (
  <div className="space-y-1.5">
    {title && (
      <span className="px-2 text-[11px] font-bold tracking-wider uppercase text-text-muted">
        {title}
      </span>
    )}
    <div className="bg-surface border border-border/80 rounded-2xl overflow-hidden divide-y divide-border/60 shadow-xs">
      {children}
    </div>
  </div>
)

// ── Main SettingsPage Component ─────────────────────────────────────────────
export function SettingsPage() {
  const db = useDb()
  const { user, refreshProfile } = useAuth()
  const { data: settings, upsert } = useUserSettings()
  const {
    theme,
    setTheme,
    accentColor,
    setAccentColor,
    navItems,
    setNavItems,
    quoteIntervalHours,
    setQuoteIntervalHours,
    autoTheme,
    setAutoTheme,
  } = useAppStore()
  const { t, locale, setLocale } = useTranslation()

  const [activeTab, setActiveTab] = useState<Tab>('profile')
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false)
  const [showClearCacheConfirm, setShowClearCacheConfirm] = useState(false)

  // ── Profile
  const [displayName, setDisplayName] = useState('')

  // ── Finance
  const [currency, setCurrency] = useState('USD')
  const [expenseCats, setExpenseCats] = useState<string[]>([
    'food',
    'transport',
    'utilities',
    'entertainment',
    'shopping',
    'health',
    'other',
  ])
  const [incomeCats, setIncomeCats] = useState<string[]>([
    'salary',
    'freelance',
    'investment',
    'gift',
    'other',
  ])

  // ── Notifications
  const [pushEnabled, setPushEnabled] = useState(false)
  const [pushLoading, setPushLoading] = useState(false)
  const [pushError, setPushError] = useState<string | null>(null)
  const [notificationsEnabled, setNotificationsEnabled] = useState(false)
  const [morningTime, setMorningTime] = useState('08:00')
  const [nightTime, setNightTime] = useState('21:00')
  const [prefs, setPrefs] = useState<Record<string, boolean>>({
    morning_reminder: true,
    evening_reminder: true,
    task_due_today: true,
    task_overdue: true,
    streak_alert: true,
    budget_alert: true,
    goal_milestone: true,
    savings_goal_reached: true,
    weekly_review: true,
  })

  // ── Recovery Key & Password
  const { isVerified: isRecoveryVerified, refreshStatus: refreshRecoveryStatus } =
    useRecoveryKeyStatus()
  const [showRecoveryModal, setShowRecoveryModal] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [updatingPassword, setUpdatingPassword] = useState(false)
  const [passwordMsg, setPasswordMsg] = useState<{
    text: string
    type: 'error' | 'success'
  } | null>(null)

  // ── Data Import/Export
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ ok: boolean; message: string } | null>(null)

  // ── Hydration tracking for Auto-Save
  const isHydratedRef = useRef(false)

  // Hydrate Push Support
  useEffect(() => {
    if (pushSupported) isPushSubscribed().then(setPushEnabled)
  }, [])

  // Hydrate from Settings query
  useEffect(() => {
    if (settings) {
      setCurrency(settings.currency || 'USD')
      if (settings.expense_categories?.length) setExpenseCats(settings.expense_categories)
      if (settings.income_categories?.length) setIncomeCats(settings.income_categories)
      setNotificationsEnabled(settings.notifications_enabled ?? false)
      setMorningTime(settings.morning_reminder_time?.slice(0, 5) || '08:00')
      setNightTime(settings.night_reminder_time?.slice(0, 5) || '21:00')
      if (settings.accent_color && !accentColor) setAccentColor(settings.accent_color)
      const settingsAny = settings as any
      if (settingsAny.auto_theme && autoTheme === 'off' && settingsAny.auto_theme !== 'off') {
        setAutoTheme(settingsAny.auto_theme)
      }
      if (settingsAny.notification_preferences) {
        setPrefs(p => ({ ...p, ...settingsAny.notification_preferences }))
      }
      // Enable auto-save after initial hydration
      setTimeout(() => {
        isHydratedRef.current = true
      }, 400)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings])

  // Hydrate user profile
  useEffect(() => {
    if (user) {
      supabaseAny
        .from('user_profiles')
        .select('display_name')
        .eq('id', user.id)
        .single()
        .then(({ data }: { data: { display_name: string } | null }) => {
          if (data?.display_name) setDisplayName(data.display_name)
        })
    }
  }, [user])

  // ── Unified Save Function
  const saveSettings = async (overrides?: any) => {
    setSaving(true)
    try {
      if (user && displayName) {
        await supabaseAny
          .from('user_profiles')
          .update({ display_name: displayName })
          .eq('id', user.id)
        const cached = await db.user_profiles.get(user.id)
        if (cached) {
          await db.user_profiles.put({ ...cached, display_name: displayName })
        }
        await refreshProfile()
      }
      await upsert.mutateAsync({
        currency,
        theme,
        accent_color: accentColor,
        expense_categories: expenseCats,
        income_categories: incomeCats,
        notifications_enabled: notificationsEnabled,
        morning_reminder_time: morningTime + ':00',
        night_reminder_time: nightTime + ':00',
        notification_preferences: prefs,
        auto_theme: autoTheme,
        ...overrides,
      } as any)
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 2000)
    } catch (err) {
      console.error('Save settings error:', err)
    } finally {
      setSaving(false)
    }
  }

  // ── Debounced Auto-Save on Settings Change
  useEffect(() => {
    if (!isHydratedRef.current) return
    const timer = setTimeout(() => {
      saveSettings()
    }, 800)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    currency,
    expenseCats,
    incomeCats,
    notificationsEnabled,
    morningTime,
    nightTime,
    prefs,
    autoTheme,
    accentColor,
    theme,
  ])

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    haptic('light')
    if (newPassword.length < 6) {
      setPasswordMsg({ text: 'Password must be at least 6 characters', type: 'error' })
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ text: 'Passwords do not match', type: 'error' })
      return
    }
    setUpdatingPassword(true)
    setPasswordMsg(null)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) {
        haptic('error')
        setPasswordMsg({ text: error.message, type: 'error' })
      } else {
        haptic('success')
        setPasswordMsg({ text: '✓ Password updated successfully!', type: 'success' })
        setNewPassword('')
        setConfirmPassword('')
      }
    } catch (err: any) {
      haptic('error')
      setPasswordMsg({ text: err.message || 'Failed to update password', type: 'error' })
    } finally {
      setUpdatingPassword(false)
    }
  }

  const handleSignOut = async () => {
    haptic('error')
    await supabase.auth.signOut()
    await db.delete()
    window.location.href = '/signin'
  }

  const handleClearCache = () => {
    haptic('error')
    db.delete().then(() => window.location.reload())
  }

  const handleTogglePush = async () => {
    if (!user) return
    haptic('light')
    setPushLoading(true)
    setPushError(null)
    try {
      if (pushEnabled) {
        await unsubscribeFromPush(user.id)
        setPushEnabled(false)
      } else {
        const result = await subscribeToPush(user.id)
        if (result.ok) setPushEnabled(true)
        else setPushError(PUSH_ERROR_MESSAGES[result.reason] ?? PUSH_ERROR_MESSAGES.unknown)
      }
    } finally {
      setPushLoading(false)
    }
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return
    haptic('light')
    setImporting(true)
    setImportResult(null)
    try {
      const parsed = JSON.parse(await file.text())
      const knownKeys = [
        'tasks',
        'notes',
        'goals',
        'agenda_blocks',
        'daily_records',
        'inbox_items',
        'data',
      ]
      if (!knownKeys.some(k => k in parsed))
        throw new Error("Doesn't look like a valid Kairo backup file.")
      const transformed = transformPayload(parsed, user.id)
      let totalImported = 0
      const warnings: string[] = []
      for (const table of TABLES) {
        const rows = transformed[table] ?? []
        if (!rows.length) continue
        for (let i = 0; i < rows.length; i += 200) {
          const { error } = await supabaseAny
            .from(table)
            .upsert(rows.slice(i, i + 200), { onConflict: 'id', ignoreDuplicates: true })
          if (error) warnings.push(`${table}: ${error.message}`)
          else totalImported += rows.slice(i, i + 200).length
        }
      }
      haptic('success')
      setImportResult({
        ok: true,
        message: warnings.length
          ? `Imported ${totalImported} records. Warnings: ${warnings.join('; ')}`
          : `Imported ${totalImported} records. Reload to see your data.`,
      })
    } catch (err) {
      haptic('error')
      setImportResult({
        ok: false,
        message: err instanceof Error ? err.message : 'Import failed.',
      })
    } finally {
      setImporting(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // ── Render Tabs ───────────────────────────────────────────────────────────
  const renderProfile = () => (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Account Info Group */}
      <SectionGroup title="Account Info">
        <SettingRow
          icon={User}
          iconBg="bg-accent/15"
          iconColor="text-accent"
          label="Display Name"
          sub="Name used in greeting and sharing"
        >
          <input
            type="text"
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            onBlur={() => saveSettings()}
            onKeyDown={e => e.key === 'Enter' && saveSettings()}
            className="w-40 sm:w-48 bg-surface-2 border border-border/80 focus:border-accent focus:bg-surface rounded-xl px-3 py-1.5 text-xs sm:text-sm font-semibold text-text focus:outline-none text-right transition-all"
            placeholder="Your name"
          />
        </SettingRow>

        <SettingRow
          icon={LogOut}
          iconBg="bg-danger/10"
          iconColor="text-danger"
          label="Sign Out"
          sub={user?.email || 'Signed in user'}
        >
          <button
            type="button"
            onClick={() => {
              haptic('error')
              setShowSignOutConfirm(true)
            }}
            className="px-3 py-1.5 bg-danger/10 text-danger text-xs font-semibold rounded-xl hover:bg-danger/15 active:scale-95 transition-all border border-danger/20 cursor-pointer"
          >
            Sign Out
          </button>
        </SettingRow>
      </SectionGroup>

      {/* Security & Recovery Group */}
      <SectionGroup title="Security & Recovery">
        <div className="p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
                <Key size={16} />
              </div>
              <div>
                <p className="text-sm font-semibold text-text">Master Recovery Key</p>
                <p className="text-xs text-text-muted">Zero-email emergency account restore phrase</p>
              </div>
            </div>
            <span
              className={clsx(
                'text-[9px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border',
                isRecoveryVerified
                  ? 'bg-success/10 text-success border-success/20'
                  : 'bg-warning/10 text-warning border-warning/20 animate-pulse'
              )}
            >
              {isRecoveryVerified ? 'Verified ✓' : 'Action Required'}
            </span>
          </div>

          <p className="text-xs text-text-secondary leading-relaxed">
            Your 12-word recovery key allows you to reset your password and restore access at any
            time without relying on external email verification.
          </p>

          <button
            type="button"
            onClick={() => {
              haptic('light')
              setShowRecoveryModal(true)
            }}
            className={clsx(
              'w-full py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs',
              isRecoveryVerified
                ? 'bg-surface-2 hover:bg-surface-3 border border-border/80 text-text'
                : 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-400 border border-amber-500/30 font-bold'
            )}
          >
            {isRecoveryVerified ? (
              <>
                <ShieldCheck size={14} className="text-success" />
                <span>View & Verify Recovery Key</span>
              </>
            ) : (
              <>
                <AlertTriangle size={14} className="text-warning" />
                <span>Backup & Verify Recovery Key</span>
              </>
            )}
          </button>
        </div>
      </SectionGroup>

      {/* Password Update Group */}
      <SectionGroup title="Change Password">
        <form onSubmit={handleUpdatePassword} className="p-4 sm:p-5 space-y-3">
          {passwordMsg && (
            <div
              className={clsx(
                'p-3 rounded-xl text-xs border flex items-center gap-2 animate-in fade-in',
                passwordMsg.type === 'error'
                  ? 'bg-danger/10 border-danger/30 text-danger'
                  : 'bg-success/10 border-success/30 text-success'
              )}
            >
              {passwordMsg.type === 'error' ? (
                <AlertTriangle size={13} />
              ) : (
                <CheckCircle size={13} />
              )}
              <span>{passwordMsg.text}</span>
            </div>
          )}

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-text-muted mb-1">
              New Password
            </label>
            <input
              type="password"
              minLength={6}
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="Min. 6 characters"
              className="w-full bg-surface-2 border border-border/80 focus:border-accent focus:bg-surface rounded-xl px-3.5 py-2 text-sm text-text focus:outline-none transition-all"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-text-muted mb-1">
              Confirm Password
            </label>
            <input
              type="password"
              minLength={6}
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Re-enter password"
              className="w-full bg-surface-2 border border-border/80 focus:border-accent focus:bg-surface rounded-xl px-3.5 py-2 text-sm text-text focus:outline-none transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={!newPassword || !confirmPassword || updatingPassword}
            className="w-full py-2.5 bg-accent text-bg font-semibold text-xs rounded-xl hover:bg-accent-dim active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-2 shadow-xs cursor-pointer"
          >
            {updatingPassword && <Loader size={12} className="animate-spin" />}
            <span>{updatingPassword ? 'Updating…' : 'Update Password (Instant)'}</span>
          </button>
        </form>
      </SectionGroup>
    </div>
  )

  const renderAppearance = () => {
    const THEME_PRESETS: {
      id: import('../../store/useAppStore').Theme
      label: string
      description: string
      swatches: [string, string, string]
    }[] = [
      {
        id: 'dark',
        label: 'Midnight',
        description: 'Default dark',
        swatches: ['#0a0a0a', '#c8b89a', '#f0ede8'],
      },
      {
        id: 'light',
        label: 'Daylight',
        description: 'Clean light',
        swatches: ['#fcfbfa', '#b09a75', '#1a1918'],
      },
      {
        id: 'oled',
        label: 'OLED Black',
        description: 'True black',
        swatches: ['#000000', '#c8b89a', '#ffffff'],
      },
      {
        id: 'warm-paper',
        label: 'Warm Paper',
        description: 'Journal feel',
        swatches: ['#F7F4EE', '#6B5344', '#1e1a15'],
      },
      {
        id: 'nordic-dusk',
        label: 'Nordic Dusk',
        description: 'Ice navy',
        swatches: ['#0f172a', '#94c5f8', '#e8f0fe'],
      },
    ]

    return (
      <div className="space-y-6 animate-in fade-in duration-200">
        {/* Theme Presets */}
        <SectionGroup title="Theme Palette">
          <div className="p-4 sm:p-5">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              {THEME_PRESETS.map(preset => {
                const selected = theme === preset.id
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      haptic('light')
                      setTheme(preset.id)
                    }}
                    className={clsx(
                      'flex flex-col items-center gap-2 py-3 px-2 rounded-2xl border transition-all relative cursor-pointer',
                      selected
                        ? 'border-accent bg-accent/8 shadow-xs ring-1 ring-accent'
                        : 'border-border/80 hover:border-border hover:bg-surface-2'
                    )}
                  >
                    <div
                      className="w-12 h-8 rounded-lg border border-border/70 overflow-hidden flex shadow-2xs"
                      style={{ backgroundColor: preset.swatches[0] }}
                    >
                      <div className="w-1/3 h-full" style={{ backgroundColor: preset.swatches[1] }} />
                      <div className="flex-1 h-full flex flex-col justify-center items-center gap-1 px-1">
                        <div
                          className="w-full h-1 rounded-full opacity-70"
                          style={{ backgroundColor: preset.swatches[2] }}
                        />
                        <div
                          className="w-3/4 h-0.5 rounded-full opacity-40"
                          style={{ backgroundColor: preset.swatches[2] }}
                        />
                      </div>
                    </div>
                    <div className="text-center leading-tight">
                      <p
                        className={clsx(
                          'text-xs font-semibold',
                          selected ? 'text-accent' : 'text-text'
                        )}
                      >
                        {preset.label}
                      </p>
                      <p className="text-[10px] text-text-muted mt-0.5">{preset.description}</p>
                    </div>
                    {selected && (
                      <div className="absolute top-1.5 right-1.5 w-4 h-4 bg-accent rounded-full flex items-center justify-center shadow-xs">
                        <Check size={10} className="text-bg" strokeWidth={3} />
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </SectionGroup>

        {/* Theme Mode */}
        <SectionGroup title="Theme Automation">
          {([
            { value: 'off', label: 'Manual Theme', sub: 'Always maintain your selected preset' },
            {
              value: 'time',
              label: 'Time-based Switch',
              sub: 'Daylight 6 AM–7 PM, Midnight overnight',
            },
            {
              value: 'system',
              label: 'Follow System',
              sub: 'Matches your operating system light/dark mode',
            },
          ] as const).map(opt => {
            const isSelected = autoTheme === opt.value
            return (
              <div
                key={opt.value}
                onClick={() => {
                  haptic('light')
                  setAutoTheme(opt.value)
                }}
                className="flex items-center justify-between gap-4 px-4 py-3.5 hover:bg-surface-2/60 active:bg-surface-2 transition-colors cursor-pointer"
              >
                <div>
                  <p className="text-sm font-semibold text-text">{opt.label}</p>
                  <p className="text-xs text-text-muted mt-0.5">{opt.sub}</p>
                </div>
                <div
                  className={clsx(
                    'w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all',
                    isSelected ? 'border-accent bg-accent' : 'border-border'
                  )}
                >
                  {isSelected && <Check size={11} className="text-bg" strokeWidth={3} />}
                </div>
              </div>
            )
          })}
        </SectionGroup>

        {/* Accent Color */}
        <SectionGroup title="Accent Color">
          <div className="p-4 sm:p-5 space-y-4">
            <p className="text-xs text-text-muted leading-relaxed">
              Customizes buttons, highlights, badges, and progress indicators throughout Kairo.
            </p>
            <div className="grid grid-cols-4 gap-2.5">
              {ACCENT_PRESETS.map((preset: AccentPreset) => {
                const selected = (accentColor ?? ACCENT_PRESETS[0].value) === preset.value
                return (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => {
                      haptic('light')
                      setAccentColor(preset.value)
                    }}
                    title={preset.name}
                    className={clsx(
                      'flex flex-col items-center gap-2 py-2.5 rounded-xl border transition-all cursor-pointer',
                      selected
                        ? 'border-accent bg-surface-2 shadow-xs'
                        : 'border-border/80 hover:border-border hover:bg-surface-2/60'
                    )}
                  >
                    <span
                      className="w-7 h-7 rounded-full border border-border/70 flex items-center justify-center shadow-xs"
                      style={{ backgroundColor: preset.value }}
                    >
                      {selected && <Check size={13} className="text-bg" strokeWidth={3} />}
                    </span>
                    <span className="text-[11px] font-medium text-text-muted">{preset.name}</span>
                  </button>
                )
              })}
            </div>

            <div className="flex items-center gap-3 pt-3 border-t border-border/60">
              <label className="relative w-9 h-9 rounded-full border border-border overflow-hidden shrink-0 cursor-pointer shadow-xs">
                <input
                  type="color"
                  value={accentColor ?? ACCENT_PRESETS[0].value}
                  onChange={e => {
                    haptic('light')
                    setAccentColor(e.target.value)
                  }}
                  className="absolute inset-0 w-full h-full cursor-pointer opacity-0"
                />
                <span
                  className="absolute inset-0"
                  style={{ backgroundColor: accentColor ?? ACCENT_PRESETS[0].value }}
                />
              </label>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-text">Custom Hex Swatch</p>
                <p className="text-[11px] text-text-muted">Tap the circle to pick any hex color</p>
              </div>
              {accentColor && (
                <button
                  type="button"
                  onClick={() => {
                    haptic('light')
                    setAccentColor(null)
                  }}
                  className="text-xs font-semibold text-text-muted hover:text-danger transition-colors cursor-pointer"
                >
                  Reset Default
                </button>
              )}
            </div>
          </div>
        </SectionGroup>

        {/* Navigation & Quotes */}
        <SectionGroup title="Workspace Layout">
          <div className="p-4 sm:p-5 space-y-4">
            <div>
              <p className="text-xs font-bold text-text mb-1">Bottom Tab Bar Shortcuts</p>
              <p className="text-xs text-text-muted mb-3">
                Home is fixed. Choose up to 4 shortcuts for your main dock.
              </p>
              <div className="grid grid-cols-2 gap-2">
                {ALL_NAV_OPTIONS.filter(o => o.key !== 'search').map(opt => {
                  const Icon = opt.icon
                  const selected = navItems.includes(opt.key)
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => {
                        haptic('light')
                        if (selected) {
                          if (navItems.length <= 1) return
                          setNavItems(navItems.filter(k => k !== opt.key))
                        } else {
                          setNavItems(
                            navItems.length >= 4
                              ? [...navItems.slice(0, 3), opt.key]
                              : [...navItems, opt.key]
                          )
                        }
                      }}
                      className={clsx(
                        'flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer',
                        selected
                          ? 'bg-accent/10 border-accent text-accent'
                          : 'bg-surface-2 border-border/80 text-text-muted hover:text-text'
                      )}
                    >
                      <Icon size={14} />
                      <span className="truncate">{opt.label}</span>
                      {selected && (
                        <span className="ml-auto w-4 h-4 bg-accent rounded-full flex items-center justify-center shrink-0">
                          <span className="text-[9px] text-bg font-bold">
                            {navItems.indexOf(opt.key) + 2}
                          </span>
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="pt-3 border-t border-border/60">
              <p className="text-xs font-bold text-text mb-1">Daily Quote Rotation</p>
              <p className="text-xs text-text-muted mb-2">How frequently the wisdom quote cycles</p>
              <div className="grid grid-cols-4 gap-2">
                {[1, 6, 12, 24].map(h => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => {
                      haptic('light')
                      setQuoteIntervalHours(h)
                    }}
                    className={clsx(
                      'py-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer',
                      quoteIntervalHours === h
                        ? 'bg-accent text-bg border-accent shadow-xs'
                        : 'bg-surface-2 border-border/80 text-text-muted hover:text-text'
                    )}
                  >
                    {h}h
                  </button>
                ))}
              </div>
            </div>
          </div>
        </SectionGroup>

        {/* Language */}
        <SectionGroup title={t('settings.language', 'Language')}>
          <div className="p-4 sm:p-5">
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => {
                  haptic('light')
                  setLocale('en')
                }}
                className={clsx(
                  'flex items-center justify-center gap-2 py-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer',
                  locale === 'en'
                    ? 'bg-accent text-bg border-accent shadow-xs'
                    : 'bg-surface-2 border-border/80 text-text-muted hover:text-text'
                )}
              >
                English
              </button>
              <button
                type="button"
                onClick={() => {
                  haptic('light')
                  setLocale('fr')
                }}
                className={clsx(
                  'flex items-center justify-center gap-2 py-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer',
                  locale === 'fr'
                    ? 'bg-accent text-bg border-accent shadow-xs'
                    : 'bg-surface-2 border-border/80 text-text-muted hover:text-text'
                )}
              >
                Français
              </button>
            </div>
          </div>
        </SectionGroup>
      </div>
    )
  }

  const renderNotifications = () => (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Master Toggle */}
      <SectionGroup title="Master Alerts">
        <SettingRow
          icon={Bell}
          iconBg="bg-rose-500/10"
          iconColor="text-rose-500"
          label="Enable Push Notifications"
          sub="Daily check-in reminders & milestone toasts"
        >
          <Toggle checked={notificationsEnabled} onChange={setNotificationsEnabled} />
        </SettingRow>

        {pushSupported && (
          <SettingRow
            icon={Globe}
            iconBg="bg-blue-500/10"
            iconColor="text-blue-500"
            label="Browser Push Subscription"
            sub={pushEnabled ? 'Device is registered' : 'Register to receive alerts when offline'}
          >
            <button
              type="button"
              onClick={handleTogglePush}
              disabled={pushLoading}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl transition-all disabled:opacity-50 border cursor-pointer',
                pushEnabled
                  ? 'text-danger bg-danger/10 border-danger/25 hover:bg-danger/15'
                  : 'text-accent bg-accent/10 border-accent/25 hover:bg-accent/15'
              )}
            >
              {pushLoading && <Loader size={12} className="animate-spin" />}
              <span>{pushEnabled ? 'Unregister' : 'Register'}</span>
            </button>
          </SettingRow>
        )}
      </SectionGroup>

      {pushError && (
        <div className="flex items-start gap-2.5 p-3.5 bg-warning/10 border border-warning/25 rounded-2xl text-xs text-warning">
          <AlertTriangle size={15} className="shrink-0 mt-0.5" />
          <span className="leading-relaxed">{pushError}</span>
        </div>
      )}

      {/* Schedule Times */}
      {notificationsEnabled && (
        <>
          <SectionGroup title="Reminder Times">
            <div className="p-4 sm:p-5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="flex items-center gap-1.5 text-[10px] text-text-muted uppercase tracking-wider mb-1.5 font-bold">
                    <Sun size={12} className="text-amber-500" /> Morning Ritual
                  </label>
                  <input
                    type="time"
                    value={morningTime}
                    onChange={e => setMorningTime(e.target.value)}
                    className="w-full bg-surface-2 border border-border/80 focus:border-accent focus:bg-surface rounded-xl px-3 py-2 text-sm font-semibold text-text focus:outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="flex items-center gap-1.5 text-[10px] text-text-muted uppercase tracking-wider mb-1.5 font-bold">
                    <Moon size={12} className="text-indigo-400" /> Evening Review
                  </label>
                  <input
                    type="time"
                    value={nightTime}
                    onChange={e => setNightTime(e.target.value)}
                    className="w-full bg-surface-2 border border-border/80 focus:border-accent focus:bg-surface rounded-xl px-3 py-2 text-sm font-semibold text-text focus:outline-none transition-all"
                  />
                </div>
              </div>
            </div>
          </SectionGroup>

          {/* Preferences Grid */}
          <SectionGroup title="Active Alert Channels">
            {[
              {
                key: 'morning_reminder',
                icon: Sun,
                label: 'Morning Check-in',
                sub: 'Daily intention & ritual kickoff',
                color: 'text-amber-500',
                bg: 'bg-amber-500/10',
              },
              {
                key: 'evening_reminder',
                icon: Moon,
                label: 'Evening Review',
                sub: 'Daily reflections & wins',
                color: 'text-indigo-400',
                bg: 'bg-indigo-500/10',
              },
              {
                key: 'task_due_today',
                icon: CalendarCheck,
                label: 'Tasks Due Today',
                sub: 'Daily morning briefing at 7:00 AM',
                color: 'text-blue-500',
                bg: 'bg-blue-500/10',
              },
              {
                key: 'task_overdue',
                icon: AlertTriangle,
                label: 'Overdue Tasks Warning',
                sub: 'Alert for yesterday’s incomplete items',
                color: 'text-rose-500',
                bg: 'bg-rose-500/10',
              },
              {
                key: 'streak_alert',
                icon: Flame,
                label: 'Habit Streak Protection',
                sub: 'Reminder when active streaks are at risk',
                color: 'text-amber-500',
                bg: 'bg-amber-500/10',
              },
              {
                key: 'budget_alert',
                icon: Wallet,
                label: 'Budget Alert',
                sub: 'Triggered when reaching 80% daily limit',
                color: 'text-emerald-500',
                bg: 'bg-emerald-500/10',
              },
              {
                key: 'goal_milestone',
                icon: PartyPopper,
                label: 'Goal Milestone Achieved',
                sub: 'Celebration confetti & real-time badge',
                color: 'text-purple-500',
                bg: 'bg-purple-500/10',
              },
              {
                key: 'savings_goal_reached',
                icon: PiggyBank,
                label: 'Savings Goal Completed',
                sub: 'Milestone reached notification',
                color: 'text-emerald-500',
                bg: 'bg-emerald-500/10',
              },
              {
                key: 'weekly_review',
                icon: BarChart3,
                label: 'Weekly Recap Summary',
                sub: 'Sundays at 7:00 PM',
                color: 'text-cyan-500',
                bg: 'bg-cyan-500/10',
              },
            ].map(item => (
              <div
                key={item.key}
                className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-surface-2/40 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={clsx(
                      'w-7 h-7 rounded-lg flex items-center justify-center shrink-0 shadow-2xs',
                      item.bg,
                      item.color
                    )}
                  >
                    <item.icon size={15} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm font-semibold text-text truncate">
                      {item.label}
                    </p>
                    <p className="text-[11px] text-text-muted mt-0.5 truncate">{item.sub}</p>
                  </div>
                </div>
                <Toggle
                  checked={prefs[item.key] !== false}
                  onChange={v => setPrefs({ ...prefs, [item.key]: v })}
                />
              </div>
            ))}
          </SectionGroup>
        </>
      )}
    </div>
  )

  const renderFinance = () => (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Currency Selection */}
      <SectionGroup title="Display Currency">
        <SettingRow
          icon={DollarSign}
          iconBg="bg-emerald-500/10"
          iconColor="text-emerald-500"
          label="Default Currency Code"
          sub="Used for budgets, transactions, and net worth"
        >
          <select
            value={currency}
            onChange={e => {
              haptic('light')
              setCurrency(e.target.value)
            }}
            className="bg-surface-2 border border-border/80 focus:border-accent focus:bg-surface rounded-xl px-3 py-1.5 text-xs sm:text-sm font-semibold text-text focus:outline-none transition-all cursor-pointer"
          >
            {['USD', 'EUR', 'GBP', 'XOF', 'NGN', 'GHS', 'JPY', 'INR', 'CAD', 'AUD'].map(c => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </SettingRow>
      </SectionGroup>

      {/* Categories */}
      <SectionGroup title="Spending & Income Categories">
        <div className="p-4 sm:p-5 space-y-5">
          <CategoryEditor
            label="Expense Categories"
            categories={expenseCats}
            onChange={setExpenseCats}
          />
          <div className="border-t border-border/60 pt-5">
            <CategoryEditor
              label="Income Categories"
              categories={incomeCats}
              onChange={setIncomeCats}
            />
          </div>
        </div>
      </SectionGroup>
    </div>
  )

  const renderData = () => (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Export Group */}
      <SectionGroup title="Data Export">
        <div className="p-4 sm:p-5 space-y-3">
          <p className="text-xs text-text-muted leading-relaxed">
            Download your entire workspace or individual tables in open formats.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                haptic('light')
                exportAllDataToJson(db)
              }}
              className="col-span-2 flex items-center justify-center gap-2 py-3 bg-accent text-bg font-semibold rounded-xl text-xs hover:bg-accent-dim active:scale-95 transition-all shadow-xs cursor-pointer"
            >
              <Download size={14} />
              <span>Full Workspace JSON Backup</span>
            </button>

            {([
              { table: 'tasks', label: 'Tasks' },
              { table: 'notes', label: 'Notes' },
              { table: 'books', label: 'Books' },
              { table: 'goals', label: 'Goals' },
              { table: 'agenda_blocks', label: 'Agenda' },
              { table: 'inbox_items', label: 'Inbox' },
              { table: 'transactions', label: 'Finance' },
            ] as const).map(({ table, label }) => (
              <button
                key={table}
                type="button"
                onClick={() => {
                  haptic('light')
                  exportTableCSV(db, table, label)
                }}
                className="flex items-center justify-center gap-1.5 py-2.5 bg-surface-2 text-text text-xs font-semibold rounded-xl hover:bg-surface-3 border border-border/80 active:scale-95 transition-all cursor-pointer"
              >
                <Download size={12} className="text-text-muted" />
                <span>{label} CSV</span>
              </button>
            ))}
          </div>
        </div>
      </SectionGroup>

      {/* Import Group */}
      <SectionGroup title="Restore Backup">
        <div className="p-4 sm:p-5 space-y-3">
          <p className="text-xs text-text-muted leading-relaxed">
            Upload any previously exported Kairo JSON backup. Existing IDs are preserved.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleImport}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => {
              haptic('light')
              fileInputRef.current?.click()
            }}
            disabled={importing}
            className="w-full py-3 bg-surface-2 text-text font-semibold text-xs rounded-xl hover:bg-surface-3 border border-border/80 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer shadow-xs"
          >
            {importing ? (
              <>
                <Loader size={14} className="animate-spin" />
                <span>Importing records…</span>
              </>
            ) : (
              <>
                <Upload size={14} />
                <span>Import JSON Backup File</span>
              </>
            )}
          </button>

          {importResult && (
            <div
              className={clsx(
                'flex items-start gap-2.5 p-3.5 rounded-xl text-xs font-medium border',
                importResult.ok
                  ? 'bg-success/10 border-success/20 text-success'
                  : 'bg-danger/10 border-danger/20 text-danger'
              )}
            >
              {importResult.ok ? (
                <CheckCircle size={15} className="shrink-0 mt-0.5" />
              ) : (
                <XCircle size={15} className="shrink-0 mt-0.5" />
              )}
              <span className="leading-relaxed">{importResult.message}</span>
            </div>
          )}

          {importResult?.ok && (
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="w-full py-2.5 mt-2 bg-accent text-bg font-semibold text-xs rounded-xl hover:bg-accent-dim active:scale-95 transition-all cursor-pointer"
            >
              Reload workspace to display imported data
            </button>
          )}
        </div>
      </SectionGroup>

      {/* Danger Zone */}
      <div className="p-4 sm:p-5 border border-danger/25 bg-danger/5 rounded-2xl space-y-2.5">
        <h3 className="text-xs font-bold text-danger flex items-center gap-1.5 uppercase tracking-wider">
          <AlertTriangle size={14} /> Danger Zone
        </h3>
        <p className="text-xs text-danger/80 leading-relaxed">
          Clears local offline storage caches. Any synced data will re-download from the cloud on
          next launch.
        </p>
        <button
          type="button"
          onClick={() => {
            haptic('error')
            setShowClearCacheConfirm(true)
          }}
          className="px-3.5 py-2 bg-danger/10 text-danger text-xs font-bold rounded-xl hover:bg-danger/20 active:scale-95 border border-danger/25 transition-all cursor-pointer"
        >
          Reset Local Cache
        </button>
      </div>
    </div>
  )

  return (
    <div className="max-w-xl mx-auto space-y-6 pb-20 px-4 sm:px-0">
      {/* Header */}
      <header className="flex items-center justify-between pt-2">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-text tracking-tight">
            Settings
          </h1>
          <p className="text-xs sm:text-sm text-text-muted mt-0.5">Preferences & configuration</p>
        </div>

        {/* Auto-Save Toast Status */}
        <div className="flex items-center gap-2">
          {saving && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-surface-2 text-text-muted rounded-full text-xs border border-border/70 shadow-2xs">
              <Loader size={12} className="animate-spin text-accent" />
              <span>Saving…</span>
            </span>
          )}
          {saveSuccess && !saving && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-success/15 text-success rounded-full text-xs font-bold border border-success/25 animate-in fade-in shadow-2xs">
              <Check size={12} strokeWidth={2.5} />
              <span>Saved</span>
            </span>
          )}
        </div>
      </header>

      {/* Unverified Recovery Key Alert Banner */}
      {!isRecoveryVerified && (
        <div className="bg-warning/10 border border-warning/30 rounded-2xl p-4 flex items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-warning/20 flex items-center justify-center text-warning shrink-0">
              <Key size={16} />
            </div>
            <div>
              <p className="text-xs font-bold text-text">Action Required: Master Recovery Key</p>
              <p className="text-[11px] text-text-muted">
                Backup your 12-word phrase to protect account access.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              haptic('light')
              setShowRecoveryModal(true)
            }}
            className="px-3 py-1.5 bg-warning text-bg font-bold text-xs rounded-xl hover:bg-warning/90 active:scale-95 transition-all whitespace-nowrap cursor-pointer shadow-xs"
          >
            Backup Now
          </button>
        </div>
      )}

      {/* iOS Segmented Tab Switcher (Matches BooksPage) */}
      <div className="grid grid-cols-5 gap-1 p-1 bg-surface-2 border border-border/80 rounded-2xl">
        {TABS.map(tab => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          const showDot = tab.id === 'profile' && !isRecoveryVerified
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                haptic('light')
                setActiveTab(tab.id)
              }}
              className={clsx(
                'relative flex items-center justify-center gap-1.5 py-2 px-1 rounded-xl transition-all duration-200 font-semibold w-full cursor-pointer',
                isActive
                  ? 'bg-surface text-text shadow-xs'
                  : 'text-text-muted hover:text-text-secondary'
              )}
            >
              <Icon size={15} strokeWidth={isActive ? 2.5 : 1.75} />
              <span className={clsx('text-xs', isActive ? 'inline' : 'hidden sm:inline')}>
                {tab.label}
              </span>
              {showDot && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-warning ring-2 ring-surface animate-pulse" />
              )}
            </button>
          )
        })}
      </div>

      {/* Active Tab Content */}
      <main>
        {activeTab === 'profile' && renderProfile()}
        {activeTab === 'appearance' && renderAppearance()}
        {activeTab === 'notifications' && renderNotifications()}
        {activeTab === 'finance' && renderFinance()}
        {activeTab === 'data' && renderData()}
      </main>

      <ConfirmDialog
        open={showSignOutConfirm}
        onOpenChange={setShowSignOutConfirm}
        title="Sign out?"
        description="Any local changes that haven't synced yet will be lost."
        confirmLabel="Sign out"
        variant="danger"
        onConfirm={handleSignOut}
      />

      <ConfirmDialog
        open={showClearCacheConfirm}
        onOpenChange={setShowClearCacheConfirm}
        title="Clear local cache?"
        description="This deletes all offline data stored on this device. Everything re-downloads from the cloud on next load — nothing synced is lost, but this device will need a connection to work again."
        confirmLabel="Clear cache"
        variant="danger"
        onConfirm={handleClearCache}
      />

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
