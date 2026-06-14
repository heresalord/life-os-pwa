import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useUserSettings } from '../../hooks/useUserSettings'
import { exportAllDataToJson, exportTransactionsCSV } from '../../lib/exportUtils'
import { db } from '../../db'
import { useAppStore } from '../../store/useAppStore'
import { ALL_NAV_OPTIONS } from '../../components/layout/AppShell'
import {
  User, Palette, Bell, DollarSign, Database,
  LogOut, Download, Upload, AlertTriangle,
  CheckCircle, XCircle, Loader, Moon, Sun,
  X, Plus, Layout, Quote, Check, Pipette,
  CalendarCheck, Flame, Wallet, PartyPopper, PiggyBank, BarChart3,
  Monitor,
} from 'lucide-react'
import { ACCENT_PRESETS, type AccentPreset } from '../../lib/colorUtils'
import {
  pushSupported, isPushSubscribed, subscribeToPush, unsubscribeFromPush
} from '../../lib/pushNotifications'
import clsx from 'clsx'

const supabaseAny = supabase as any
type AnyRow = Record<string, unknown>

const PUSH_ERROR_MESSAGES: Record<string, string> = {
  no_vapid_key:      'Push notifications are not configured for this app.',
  no_sw_support:     'Your browser does not support push notifications.',
  permission_denied: 'Notification permission was denied. Enable it in your browser settings.',
  sw_failed:         'Failed to register the service worker. Try refreshing.',
  unknown:           'Something went wrong enabling notifications.',
}

const TABLES = [
  'daily_records', 'tasks', 'transactions', 'goals', 'goal_events',
  'books', 'quotes', 'agenda_blocks', 'inbox_items', 'notes'
]

function transformPayload(raw: any, userId: string): Record<string, AnyRow[]> {
  const isNewFormat = raw.schema_version === 1 && raw.data
  const source = isNewFormat ? raw.data : raw
  const now = new Date().toISOString()
  const mapUser = (rows: AnyRow[]) => rows.map(r => ({ ...r, user_id: userId }))
  return {
    tasks: (source.tasks ?? []).map((r: AnyRow) => ({
      id: r.id, user_id: userId, date: r.date, title: r.title,
      completed: r.completed ?? false, skipped: r.skipped ?? false,
      priority: r.priority ?? null, completed_at: r.completed_at ?? null,
      skipped_at: r.skipped_at ?? null, carried_from: r.carried_from ?? null,
      from_inbox_id: r.from_inbox_id ?? null, created_at: r.created_at ?? now,
    })),
    notes: (source.notes ?? []).map((r: AnyRow) => ({
      id: r.id, user_id: userId, date: r.date, title: r.title ?? 'Note',
      content: r.content ?? '',
      template: r.template === 'free' || r.template === 'freewrite' ? null
        : r.template === 'morning' ? 'morning'
        : r.template === 'night' ? 'night' : null,
      created_at: r.created_at ?? now, updated_at: r.updated_at ?? now,
    })),
    agenda_blocks: (source.agenda_blocks ?? []).map((r: AnyRow) => ({
      id: r.id, user_id: userId, date: r.date,
      start_time: r.start_time, end_time: r.end_time,
      description: (r.description ?? r.title ?? 'Block') as string,
      created_at: r.created_at ?? now,
    })),
    goals: (source.goals ?? []).map((r: AnyRow) => ({
      id: r.id, user_id: userId, name: r.name,
      goal_type: (r.goal_type as string) ?? 'general',
      measurement_type: (r.measurement_type as string) ?? 'count',
      target: r.target ?? null, currency: r.currency ?? null,
      start_date: r.start_date ?? null, end_date: r.end_date ?? null,
      state: (r.state as string) ?? 'active', is_completed: r.is_completed ?? false,
      sub_goals: r.sub_goals ?? [], created_at: r.created_at ?? now, updated_at: r.updated_at ?? now,
    })),
    daily_records: (source.daily_records ?? []).map((r: AnyRow) => ({
      id: r.id, user_id: userId, date: r.date, mood: r.mood ?? null,
      intent: r.intent ?? null, reflections: r.reflections ?? {},
      energy_am: r.energy_am ?? null, energy_pm: r.energy_pm ?? null,
      gratitude: r.gratitude ?? [], win_of_day: r.win_of_day ?? null,
      went_well: r.went_well ?? null, do_differently: r.do_differently ?? null,
      tomorrow_focus: r.tomorrow_focus ?? null,
      morning_complete: r.morning_complete ?? false,
      evening_complete: r.evening_complete ?? false,
      day_score: r.day_score ?? 0, journal: r.journal ?? null,
      created_at: r.created_at ?? r.updated_at ?? now, updated_at: r.updated_at ?? now,
    })),
    transactions: mapUser(source.transactions ?? []),
    goal_events:  mapUser(source.goal_events ?? []),
    books:        mapUser(source.books ?? []),
    quotes:       mapUser(source.quotes ?? []),
    inbox_items: (source.inbox_items ?? []).map((r: AnyRow) => ({
      id: r.id, user_id: userId, text: r.text, type: r.type ?? 'thought',
      processed: r.processed ?? false, processed_at: r.processed_at ?? null,
      processed_to: r.processed_to ?? null, archived_at: r.archived_at ?? null,
      captured_at: r.captured_at ?? now,
    })),
  }
}

function CategoryEditor({ label, categories, onChange }: {
  label: string; categories: string[]; onChange: (cats: string[]) => void
}) {
  const [input, setInput] = useState('')
  const add = () => {
    const val = input.trim().toLowerCase()
    if (!val || categories.includes(val)) return
    onChange([...categories, val])
    setInput('')
  }
  const remove = (cat: string) => onChange(categories.filter(c => c !== cat))
  return (
    <div>
      <label className="block text-xs text-text-muted mb-2 uppercase tracking-wider">{label}</label>
      <div className="flex flex-wrap gap-2 mb-2 min-h-[36px]">
        {categories.map(cat => (
          <span key={cat} className="flex items-center gap-1 px-2.5 py-1 bg-surface-2 border border-border rounded-full text-xs text-text capitalize">
            {cat}
            <button onClick={() => remove(cat)} className="text-text-muted hover:text-danger transition-colors ml-0.5">
              <X size={11} />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="text" value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), add())}
          placeholder="Add category…"
          className="flex-1 bg-surface-2 border border-border rounded-xl px-3 py-2 text-sm text-text placeholder-text-muted focus:border-accent focus:outline-none"
        />
        <button onClick={add} className="px-3 py-2 bg-accent/15 text-accent rounded-xl hover:bg-accent/25 transition-colors">
          <Plus size={16} />
        </button>
      </div>
    </div>
  )
}

// ─── Tab types ───────────────────────────────────────────────────────────────
type Tab = 'profile' | 'appearance' | 'notifications' | 'finance' | 'data'

const TABS: { id: Tab; label: string; icon: React.FC<any> }[] = [
  { id: 'profile',       label: 'Profile',       icon: User       },
  { id: 'appearance',    label: 'Appearance',     icon: Palette    },
  { id: 'notifications', label: 'Notifications',  icon: Bell       },
  { id: 'finance',       label: 'Finance',        icon: DollarSign },
  { id: 'data',          label: 'Data',           icon: Database   },
]

// ─── SettingsPage ─────────────────────────────────────────────────────────────
export function SettingsPage() {
  const { user, refreshProfile } = useAuth()
  const { data: settings, upsert } = useUserSettings()
  const { theme, setTheme, accentColor, setAccentColor, navItems, setNavItems, quoteIntervalHours, setQuoteIntervalHours, autoTheme, setAutoTheme } = useAppStore()

  const [activeTab, setActiveTab] = useState<Tab>('profile')
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  // ── Profile
  const [displayName, setDisplayName] = useState('')

  // ── Finance
  const [currency, setCurrency] = useState('USD')
  const [expenseCats, setExpenseCats] = useState<string[]>(['food', 'transport', 'utilities', 'entertainment', 'shopping', 'health', 'other'])
  const [incomeCats,  setIncomeCats]  = useState<string[]>(['salary', 'freelance', 'investment', 'gift', 'other'])

  // ── Notifications
  const [pushEnabled,           setPushEnabled]           = useState(false)
  const [pushLoading,           setPushLoading]           = useState(false)
  const [pushError,             setPushError]             = useState<string | null>(null)
  const [notificationsEnabled,  setNotificationsEnabled]  = useState(false)
  const [morningTime,           setMorningTime]           = useState('08:00')
  const [nightTime,             setNightTime]             = useState('21:00')
  const [prefs, setPrefs] = useState<Record<string, boolean>>({
    morning_reminder: true, evening_reminder: true, task_due_today: true,
    task_overdue: true, streak_alert: true, budget_alert: true,
    goal_milestone: true, savings_goal_reached: true, weekly_review: true,
  })

  // ── Data
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importing,    setImporting]    = useState(false)
  const [importResult, setImportResult] = useState<{ ok: boolean; message: string } | null>(null)

  // ── Hydrate
  useEffect(() => {
    if (pushSupported) isPushSubscribed().then(setPushEnabled)
  }, [])

  useEffect(() => {
    if (settings) {
      setCurrency(settings.currency || 'USD')
      if (settings.expense_categories?.length) setExpenseCats(settings.expense_categories)
      if (settings.income_categories?.length)  setIncomeCats(settings.income_categories)
      setNotificationsEnabled(settings.notifications_enabled ?? false)
      setMorningTime(settings.morning_reminder_time?.slice(0, 5) || '08:00')
      setNightTime(settings.night_reminder_time?.slice(0, 5) || '21:00')
      // Sync accent color from the server on a fresh device — local choice
      // (made on this device, via setAccentColor below) always wins once set.
      if (settings.accent_color && !accentColor) setAccentColor(settings.accent_color)
      // Restore auto-theme mode from the server on a fresh device.
      const settingsAny = settings as any
      if (settingsAny.auto_theme && autoTheme === 'off' && settingsAny.auto_theme !== 'off') {
        setAutoTheme(settingsAny.auto_theme)
      }
      if (settingsAny.notification_preferences) {
        setPrefs(p => ({ ...p, ...settingsAny.notification_preferences }))
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings])

  useEffect(() => {
    if (user) {
      supabaseAny.from('user_profiles').select('display_name').eq('id', user.id).single()
        .then(({ data }: { data: { display_name: string } | null }) => {
          if (data?.display_name) setDisplayName(data.display_name)
        })
    }
  }, [user])

  // ── Actions
  const handleSave = async () => {
    setSaving(true)
    setSaveSuccess(false)
    try {
      if (user && displayName) {
        await supabaseAny.from('user_profiles').update({ display_name: displayName }).eq('id', user.id)
        // Keep Dexie in sync so AuthContext (sidebar/topbar) reflects the new
        // name immediately without requiring a page reload.
        const cached = await db.user_profiles.get(user.id)
        if (cached) {
          await db.user_profiles.put({ ...cached, display_name: displayName })
        }
        await refreshProfile()
      }
      await upsert.mutateAsync({
        currency, theme,
        accent_color: accentColor,
        expense_categories: expenseCats,
        income_categories:  incomeCats,
        notifications_enabled: notificationsEnabled,
        morning_reminder_time: morningTime + ':00',
        night_reminder_time:   nightTime   + ':00',
        notification_preferences: prefs,
        auto_theme: autoTheme,
      } as any)
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 2500)
    } finally {
      setSaving(false)
    }
  }

  const handleSignOut = async () => {
    if (window.confirm('Sign out? Unsynced local data will be lost.')) {
      await supabase.auth.signOut()
      await db.delete()
      window.location.href = '/signin'
    }
  }

  const handleTogglePush = async () => {
    if (!user) return
    setPushLoading(true); setPushError(null)
    try {
      if (pushEnabled) {
        await unsubscribeFromPush(user.id)
        setPushEnabled(false)
      } else {
        const result = await subscribeToPush(user.id)
        if (result.ok) setPushEnabled(true)
        else setPushError(PUSH_ERROR_MESSAGES[result.reason] ?? PUSH_ERROR_MESSAGES.unknown)
      }
    } finally { setPushLoading(false) }
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return
    setImporting(true); setImportResult(null)
    try {
      const parsed = JSON.parse(await file.text())
      const knownKeys = ['tasks', 'notes', 'goals', 'agenda_blocks', 'daily_records', 'inbox_items', 'data']
      if (!knownKeys.some(k => k in parsed)) throw new Error("Doesn't look like a Life OS backup file.")
      const transformed = transformPayload(parsed, user.id)
      let totalImported = 0
      const warnings: string[] = []
      for (const table of TABLES) {
        const rows = transformed[table] ?? []
        if (!rows.length) continue
        for (let i = 0; i < rows.length; i += 200) {
          const { error } = await supabaseAny.from(table).upsert(rows.slice(i, i + 200), { onConflict: 'id', ignoreDuplicates: true })
          if (error) warnings.push(`${table}: ${error.message}`)
          else totalImported += rows.slice(i, i + 200).length
        }
      }
      setImportResult({
        ok: true,
        message: warnings.length
          ? `Imported ${totalImported} records. Warnings: ${warnings.join('; ')}`
          : `Imported ${totalImported} records. Reload to see your data.`,
      })
    } catch (err) {
      setImportResult({ ok: false, message: err instanceof Error ? err.message : 'Import failed.' })
    } finally {
      setImporting(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // ─── Render helpers ────────────────────────────────────────────────────────
  const SettingRow = ({ label, sub, children }: { label: string; sub?: string; children: React.ReactNode }) => (
    <div className="flex items-center justify-between gap-4 py-3.5 border-b border-border/50 last:border-0">
      <div className="min-w-0">
        <p className="text-sm font-medium text-text">{label}</p>
        {sub && <p className="text-xs text-text-muted mt-0.5">{sub}</p>}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  )

  const SectionCard = ({ title, icon: Icon, children }: { title: string; icon: React.FC<any>; children: React.ReactNode }) => (
    <div className="bg-surface border border-border rounded-2xl overflow-hidden">
      <div className="px-5 pt-4 pb-2 flex items-center gap-2 border-b border-border/40">
        <Icon size={14} className="text-text-muted" />
        <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">{title}</span>
      </div>
      <div className="px-5 pb-4">{children}</div>
    </div>
  )

  // ─── Tab content ──────────────────────────────────────────────────────────
  const renderProfile = () => (
    <div className="space-y-4 animate-in fade-in duration-200">
      <SectionCard title="Account" icon={User}>
        <SettingRow label="Display Name">
          <input
            type="text" value={displayName} onChange={e => setDisplayName(e.target.value)}
            className="w-44 bg-surface-2 border border-border rounded-xl px-3 py-1.5 text-sm text-text focus:border-accent focus:outline-none text-right"
          />
        </SettingRow>
        <SettingRow label="Email" sub={user?.email}>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-danger/10 text-danger text-xs font-medium rounded-lg hover:bg-danger/20 transition-colors"
          >
            <LogOut size={13} /> Sign Out
          </button>
        </SettingRow>
      </SectionCard>
    </div>
  )

  const renderAppearance = () => (
    <div className="space-y-4 animate-in fade-in duration-200">
      <SectionCard title="Theme" icon={Palette}>
        <div className="pt-3 grid grid-cols-2 gap-2">
          <button
            onClick={() => setTheme('dark')}
            className={clsx(
              'flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-medium transition-all',
              theme === 'dark' ? 'bg-surface-2 border-accent text-accent' : 'border-border text-text-muted hover:text-text hover:border-text-muted'
            )}
          >
            <Moon size={15} /> Dark
          </button>
          <button
            onClick={() => setTheme('light')}
            className={clsx(
              'flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-medium transition-all',
              theme === 'light' ? 'bg-surface-2 border-accent text-accent' : 'border-border text-text-muted hover:text-text hover:border-text-muted'
            )}
          >
            <Sun size={15} /> Light
          </button>
        </div>
      </SectionCard>

      <SectionCard title="Theme Mode" icon={Monitor}>
        <p className="text-xs text-text-muted pt-3 pb-3 leading-relaxed">
          Override the manual toggle with automatic switching.
        </p>
        <div className="space-y-2">
          {([
            { value: 'off',    label: 'Manual',        sub: 'Use the light/dark toggle above' },
            { value: 'time',   label: 'Time-based',    sub: 'Light 6 AM–7 PM, dark overnight' },
            { value: 'system', label: 'Follow system', sub: 'Matches your device theme' },
          ] as const).map(opt => (
            <label key={opt.value}
              className={clsx(
                'flex items-center gap-3 px-3.5 py-3 rounded-xl border cursor-pointer transition-all',
                autoTheme === opt.value
                  ? 'bg-accent/5 border-accent/25'
                  : 'bg-surface-2 border-border hover:border-text-muted/40'
              )}
            >
              <input type="radio" name="auto_theme"
                value={opt.value}
                checked={autoTheme === opt.value}
                onChange={() => setAutoTheme(opt.value)}
                className="sr-only"
              />
              <div className="flex-1">
                <p className="text-sm font-medium text-text">{opt.label}</p>
                <p className="text-[11px] text-text-muted">{opt.sub}</p>
              </div>
              <div className={clsx(
                'w-4 h-4 rounded-full border-2 transition-all',
                autoTheme === opt.value ? 'border-accent bg-accent' : 'border-border'
              )} />
            </label>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Accent Color" icon={Pipette}>
        <p className="text-xs text-text-muted pt-3 pb-3 leading-relaxed">
          Replaces the highlight color used for buttons, active states, and progress indicators.
        </p>
        <div className="grid grid-cols-4 gap-2">
          {ACCENT_PRESETS.map((preset: AccentPreset) => {
            const selected = (accentColor ?? ACCENT_PRESETS[0].value) === preset.value
            return (
              <button
                key={preset.value}
                onClick={() => setAccentColor(preset.value)}
                title={preset.name}
                className={clsx(
                  'flex flex-col items-center gap-1.5 py-2.5 rounded-xl border transition-all',
                  selected ? 'border-accent bg-surface-2' : 'border-border hover:border-text-muted/40'
                )}
              >
                <span
                  className="w-6 h-6 rounded-full border border-border/60 flex items-center justify-center"
                  style={{ backgroundColor: preset.value }}
                >
                  {selected && <Check size={12} className="text-bg" strokeWidth={3} />}
                </span>
                <span className="text-[11px] text-text-muted">{preset.name}</span>
              </button>
            )
          })}
        </div>
        <div className="flex items-center gap-3 mt-3 pt-3 border-t border-border/50">
          <label className="relative w-9 h-9 rounded-full border border-border overflow-hidden flex-shrink-0 cursor-pointer">
            <input
              type="color"
              value={accentColor ?? ACCENT_PRESETS[0].value}
              onChange={e => setAccentColor(e.target.value)}
              className="absolute inset-0 w-full h-full cursor-pointer opacity-0"
            />
            <span className="absolute inset-0" style={{ backgroundColor: accentColor ?? ACCENT_PRESETS[0].value }} />
          </label>
          <div className="min-w-0">
            <p className="text-sm font-medium text-text">Custom color</p>
            <p className="text-[11px] text-text-muted">Tap the swatch to pick any color</p>
          </div>
          {accentColor && (
            <button
              onClick={() => setAccentColor(null)}
              className="ml-auto text-xs font-medium text-text-muted hover:text-danger transition-colors"
            >
              Reset
            </button>
          )}
        </div>
      </SectionCard>

      <SectionCard title="Navigation" icon={Layout}>
        <p className="text-xs text-text-muted py-3 leading-relaxed">
          Home is always first. Pick up to 4 more slots — hidden pages stay reachable via the ☰ menu.
        </p>
        <div className="grid grid-cols-2 gap-2">
          {ALL_NAV_OPTIONS.filter(o => o.key !== 'search').map(opt => {
            const Icon = opt.icon
            const selected = navItems.includes(opt.key)
            return (
              <button
                key={opt.key}
                onClick={() => {
                  if (selected) {
                    if (navItems.length <= 1) return
                    setNavItems(navItems.filter(k => k !== opt.key))
                  } else {
                    setNavItems(navItems.length >= 4
                      ? [...navItems.slice(0, 3), opt.key]
                      : [...navItems, opt.key]
                    )
                  }
                }}
                className={clsx(
                  'flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all',
                  selected
                    ? 'bg-accent/10 border-accent text-accent'
                    : 'bg-surface-2 border-border text-text-muted hover:text-text hover:border-text-muted'
                )}
              >
                <Icon size={15} />
                {opt.label}
                {selected && (
                  <span className="ml-auto w-4 h-4 bg-accent rounded-full flex items-center justify-center">
                    <span className="text-[9px] text-bg font-bold">{navItems.indexOf(opt.key) + 2}</span>
                  </span>
                )}
              </button>
            )
          })}
        </div>
        <p className="text-[11px] text-text-muted mt-3">{navItems.length}/4 slots used</p>
      </SectionCard>

      <SectionCard title="Quote Widget" icon={Quote}>
        <p className="text-xs text-text-muted py-3">How often the dashboard quote rotates automatically.</p>
        <div className="grid grid-cols-4 gap-2">
          {[1, 6, 12, 24].map(h => (
            <button
              key={h}
              onClick={() => setQuoteIntervalHours(h)}
              className={clsx(
                'py-2.5 rounded-xl border text-sm font-medium transition-all',
                quoteIntervalHours === h
                  ? 'bg-accent/10 border-accent text-accent'
                  : 'bg-surface-2 border-border text-text-muted hover:text-text'
              )}
            >
              {h}h
            </button>
          ))}
        </div>
      </SectionCard>
    </div>
  )

  const renderNotifications = () => (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Master toggle */}
      <SectionCard title="Push Alerts" icon={Bell}>
        <SettingRow
          label="Enable Notifications"
          sub="Reminders, milestones & alerts"
        >
          <button
            onClick={() => setNotificationsEnabled(!notificationsEnabled)}
            className={clsx(
              'px-3 py-1.5 text-xs font-medium rounded-lg transition-colors',
              notificationsEnabled
                ? 'bg-danger/10 text-danger hover:bg-danger/20'
                : 'bg-accent/10 text-accent hover:bg-accent/20'
            )}
          >
            {notificationsEnabled ? 'Disable' : 'Enable'}
          </button>
        </SettingRow>

        {pushSupported && (
          <SettingRow label="Web Push (Browser)" sub={pushEnabled ? 'This browser is registered' : 'Register to receive push alerts'}>
            <button
              onClick={handleTogglePush}
              disabled={pushLoading}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors disabled:opacity-50',
                pushEnabled ? 'bg-danger/10 text-danger hover:bg-danger/20' : 'bg-accent/10 text-accent hover:bg-accent/20'
              )}
            >
              {pushLoading && <Loader size={11} className="animate-spin" />}
              {pushEnabled ? 'Unregister' : 'Register'}
            </button>
          </SettingRow>
        )}

        {pushError && (
          <div className="flex items-start gap-2 p-3 bg-warning/10 border border-warning/20 rounded-xl text-xs text-warning mt-2">
            <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" />
            {pushError}
          </div>
        )}
      </SectionCard>

      {/* Schedule times */}
      {notificationsEnabled && (
        <>
          <SectionCard title="Reminder Times" icon={Bell}>
            <div className="grid grid-cols-2 gap-3 pt-3">
              <div>
                <label className="flex items-center gap-1.5 text-[11px] text-text-muted uppercase tracking-wider mb-1.5">
                  <Sun size={11} /> Morning
                </label>
                <input
                  type="time" value={morningTime} onChange={e => setMorningTime(e.target.value)}
                  className="w-full bg-surface-2 border border-border rounded-xl px-3 py-2.5 text-sm text-text focus:border-accent focus:outline-none"
                />
              </div>
              <div>
                <label className="flex items-center gap-1.5 text-[11px] text-text-muted uppercase tracking-wider mb-1.5">
                  <Moon size={11} /> Evening
                </label>
                <input
                  type="time" value={nightTime} onChange={e => setNightTime(e.target.value)}
                  className="w-full bg-surface-2 border border-border rounded-xl px-3 py-2.5 text-sm text-text focus:border-accent focus:outline-none"
                />
              </div>
            </div>
          </SectionCard>

          {/* Preferences grid */}
          <SectionCard title="Reminder Types" icon={Bell}>
            <div className="pt-3 space-y-2">
              {[
                { key: 'morning_reminder',    icon: Sun,          label: 'Morning Check-in',      sub: 'Daily intention & mood' },
                { key: 'evening_reminder',    icon: Moon,         label: 'Evening Review',         sub: 'Reflection & wins' },
                { key: 'task_due_today',      icon: CalendarCheck, label: 'Tasks Due Today',        sub: 'At 7:00 AM' },
                { key: 'task_overdue',        icon: AlertTriangle, label: 'Overdue Tasks',          sub: 'At 9:00 AM' },
                { key: 'streak_alert',        icon: Flame,        label: 'Streak at Risk',         sub: 'Active habits only, 8 PM' },
                { key: 'budget_alert',        icon: Wallet,       label: 'Budget Warning',         sub: 'When 80%+ daily budget used' },
                { key: 'goal_milestone',      icon: PartyPopper,  label: 'Goal Completed',         sub: 'Real-time' },
                { key: 'savings_goal_reached',icon: PiggyBank,    label: 'Savings Goal Reached',   sub: 'Real-time' },
                { key: 'weekly_review',       icon: BarChart3,    label: 'Weekly Review',          sub: 'Sundays at 7 PM' },
              ].map(item => (
                <label
                  key={item.key}
                  className={clsx(
                    'flex items-center gap-3 px-3.5 py-3 rounded-xl border cursor-pointer transition-all',
                    prefs[item.key] !== false
                      ? 'bg-accent/5 border-accent/25'
                      : 'bg-surface-2 border-border hover:border-text-muted/40'
                  )}
                >
                  <input
                    type="checkbox"
                    checked={prefs[item.key] !== false}
                    onChange={e => setPrefs({ ...prefs, [item.key]: e.target.checked })}
                    className="sr-only"
                  />
                  <item.icon size={16} className="text-text-muted flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text">{item.label}</p>
                    <p className="text-[11px] text-text-muted">{item.sub}</p>
                  </div>
                  <div className={clsx(
                    'w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 transition-all',
                    prefs[item.key] !== false ? 'bg-accent border-accent' : 'border-border'
                  )}>
                    {prefs[item.key] !== false && <Check size={12} className="text-bg" strokeWidth={3} />}
                  </div>
                </label>
              ))}
            </div>
          </SectionCard>
        </>
      )}
    </div>
  )

  const renderFinance = () => (
    <div className="space-y-4 animate-in fade-in duration-200">
      <SectionCard title="Currency" icon={DollarSign}>
        <div className="pt-3">
          <select
            value={currency} onChange={e => setCurrency(e.target.value)}
            className="w-full bg-surface-2 border border-border rounded-xl px-4 py-3 text-text focus:border-accent focus:outline-none appearance-none text-sm"
          >
            {['USD','EUR','GBP','XOF','NGN','GHS','JPY','INR','CAD','AUD'].map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </SectionCard>

      <SectionCard title="Categories" icon={DollarSign}>
        <div className="pt-3 space-y-5">
          <CategoryEditor label="Expense Categories" categories={expenseCats} onChange={setExpenseCats} />
          <div className="border-t border-border/50 pt-5">
            <CategoryEditor label="Income Categories" categories={incomeCats} onChange={setIncomeCats} />
          </div>
        </div>
      </SectionCard>
    </div>
  )

  const renderData = () => (
    <div className="space-y-4 animate-in fade-in duration-200">
      <SectionCard title="Export" icon={Download}>
        <div className="pt-3 grid grid-cols-2 gap-3">
          <button
            onClick={exportAllDataToJson}
            className="flex items-center justify-center gap-2 py-3 bg-surface-2 text-text text-sm font-medium rounded-xl hover:bg-muted border border-border transition-colors"
          >
            <Download size={14} /> JSON Backup
          </button>
          <button
            onClick={exportTransactionsCSV}
            className="flex items-center justify-center gap-2 py-3 bg-surface-2 text-text text-sm font-medium rounded-xl hover:bg-muted border border-border transition-colors"
          >
            <Download size={14} /> Finance CSV
          </button>
        </div>
      </SectionCard>

      <SectionCard title="Import" icon={Upload}>
        <p className="text-xs text-text-muted pt-3 pb-3 leading-relaxed">
          Accepts any Life OS JSON backup. Records with matching IDs are skipped.
        </p>
        <input ref={fileInputRef} type="file" accept=".json,application/json" onChange={handleImport} className="hidden" />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={importing}
          className="w-full py-3 bg-surface-2 text-text font-medium text-sm rounded-xl hover:bg-muted border border-border transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {importing
            ? <><Loader size={14} className="animate-spin" /> Importing…</>
            : <><Upload size={14} /> Import JSON Backup</>
          }
        </button>
        {importResult && (
          <div className={clsx(
            'flex items-start gap-3 p-4 rounded-xl text-sm mt-3',
            importResult.ok ? 'bg-success/10 border border-success/20 text-success' : 'bg-danger/10 border border-danger/20 text-danger'
          )}>
            {importResult.ok ? <CheckCircle size={15} className="flex-shrink-0 mt-0.5" /> : <XCircle size={15} className="flex-shrink-0 mt-0.5" />}
            <span>{importResult.message}</span>
          </div>
        )}
        {importResult?.ok && (
          <button onClick={() => window.location.reload()}
            className="w-full py-2.5 mt-2 bg-accent text-bg font-medium text-sm rounded-xl hover:bg-accent-dim transition-colors"
          >
            Reload to see imported data
          </button>
        )}
      </SectionCard>

      <div className="p-5 border border-danger/30 bg-danger/5 rounded-2xl space-y-3">
        <h3 className="text-sm font-medium text-danger flex items-center gap-2">
          <AlertTriangle size={15} /> Danger Zone
        </h3>
        <p className="text-xs text-danger/75 leading-relaxed">
          Clears the local offline cache. Data re-fetches from the cloud on next load.
        </p>
        <button
          onClick={() => { if (window.confirm('Clear local cache?')) db.delete().then(() => window.location.reload()) }}
          className="px-4 py-2 bg-danger/10 text-danger text-xs font-medium rounded-lg hover:bg-danger/20 transition-colors"
        >
          Reset Local Cache
        </button>
      </div>
    </div>
  )

  return (
    <div className="space-y-4 lg:max-w-2xl">
      <header>
        <h1 className="text-2xl font-display text-text">Settings</h1>
      </header>

      {/* ── Tab bar — matches Finance/Tasks pattern exactly ── */}
      <div className={clsx(
        'grid gap-1 p-1 bg-surface-2 border border-border rounded-2xl',
        'grid-cols-5'
      )}>
        {TABS.map(tab => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={clsx(
                'flex items-center justify-center gap-1 py-2 px-1 rounded-xl transition-all duration-200 font-medium w-full',
                isActive ? 'bg-surface text-text shadow-sm' : 'text-text-muted hover:text-text-secondary'
              )}
            >
              <Icon size={15} strokeWidth={isActive ? 2.5 : 1.75} />
              <span className={clsx('text-xs', isActive ? 'inline' : 'hidden sm:inline')}>
                {tab.label}
              </span>
            </button>
          )
        })}
      </div>

      {/* ── Tab content ── */}
      <div>
        {activeTab === 'profile'       && renderProfile()}
        {activeTab === 'appearance'    && renderAppearance()}
        {activeTab === 'notifications' && renderNotifications()}
        {activeTab === 'finance'       && renderFinance()}
        {activeTab === 'data'          && renderData()}
      </div>

      {/* ── Save button (hidden on Data tab) ── */}
      {activeTab !== 'data' && (
        <button
          onClick={handleSave}
          disabled={saving}
          className={clsx(
            'w-full py-3.5 font-medium rounded-xl transition-all duration-300 flex items-center justify-center gap-2 text-sm',
            saveSuccess
              ? 'bg-success text-bg'
              : 'bg-accent text-bg hover:bg-accent-dim disabled:opacity-50'
          )}
        >
          {saving      && <Loader size={15} className="animate-spin" />}
          {saveSuccess && <Check  size={15} />}
          {saving ? 'Saving…' : saveSuccess ? 'Saved!' : 'Save Changes'}
        </button>
      )}
    </div>
  )
}
