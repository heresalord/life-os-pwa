import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useUserSettings } from '../../hooks/useUserSettings'
import { exportAllDataToJson, exportTransactionsCSV } from '../../lib/exportUtils'
import { db } from '../../db'
import { useAppStore } from '../../store/useAppStore'
import { ALL_NAV_OPTIONS } from '../../components/layout/AppShell'
import {
  Settings, LogOut, Download, Upload, AlertTriangle, User,
  CheckCircle, XCircle, Loader, Moon, Sun, X, Plus, Bell, Layout, Quote
} from 'lucide-react'
import { pushSupported, isPushSubscribed, subscribeToPush, unsubscribeFromPush } from '../../lib/pushNotifications'
import clsx from 'clsx'

const supabaseAny = supabase as any
type AnyRow = Record<string, unknown>

const TABLES = [
  'daily_records', 'tasks', 'transactions', 'goals', 'goal_events',
  'books', 'quotes', 'agenda_blocks', 'inbox_items', 'notes'
]

const PUSH_ERROR_MESSAGES: Record<string, string> = {
  no_vapid_key:      'Push notifications are not configured for this app.',
  no_sw_support:     'Your browser does not support push notifications.',
  permission_denied: 'Notification permission was denied. Enable it in your browser settings.',
  sw_failed:         'Failed to register the service worker. Try refreshing.',
  unknown:           'Something went wrong enabling notifications.',
}

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

function CategoryEditor({
  label, categories, onChange
}: { label: string; categories: string[]; onChange: (cats: string[]) => void }) {
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
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), add())}
          placeholder="Add category…"
          className="flex-1 bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-text placeholder-text-muted focus:border-accent focus:outline-none"
        />
        <button onClick={add} className="px-3 py-2 bg-accent/15 text-accent rounded-lg hover:bg-accent/25 transition-colors">
          <Plus size={16} />
        </button>
      </div>
    </div>
  )
}

export function SettingsPage() {
  const { user } = useAuth()
  const { data: settings, upsert } = useUserSettings()
  const { theme, setTheme, navItems, setNavItems, quoteIntervalHours, setQuoteIntervalHours } = useAppStore()

  const [currency, setCurrency] = useState('USD')
  const [displayName, setDisplayName] = useState('')
  const [expenseCats, setExpenseCats] = useState<string[]>(['food', 'transport', 'utilities', 'entertainment', 'shopping', 'health', 'other'])
  const [incomeCats, setIncomeCats] = useState<string[]>(['salary', 'freelance', 'investment', 'gift', 'other'])
  const [saving, setSaving] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ ok: boolean; message: string } | null>(null)

  const [pushEnabled, setPushEnabled] = useState(false)
  const [pushLoading, setPushLoading] = useState(false)
  const [pushError, setPushError] = useState<string | null>(null)

  useEffect(() => {
    if (pushSupported) isPushSubscribed().then(setPushEnabled)
  }, [])

  const handleTogglePush = async () => {
    if (!user) return
    setPushLoading(true)
    setPushError(null)
    try {
      if (pushEnabled) {
        await unsubscribeFromPush(user.id)
        setPushEnabled(false)
      } else {
        const result = await subscribeToPush(user.id)
        if (result.ok) {
          setPushEnabled(true)
        } else {
          setPushError(PUSH_ERROR_MESSAGES[result.reason] ?? PUSH_ERROR_MESSAGES.unknown)
        }
      }
    } finally {
      setPushLoading(false)
    }
  }

  useEffect(() => {
    if (settings) {
      setCurrency(settings.currency || 'USD')
      if (settings.expense_categories?.length) setExpenseCats(settings.expense_categories)
      if (settings.income_categories?.length) setIncomeCats(settings.income_categories)
    }
  }, [settings])

  useEffect(() => {
    if (user) {
      supabaseAny.from('user_profiles').select('display_name').eq('id', user.id).single()
        .then(({ data }: { data: { display_name: string } | null }) => {
          if (data?.display_name) setDisplayName(data.display_name)
        })
    }
  }, [user])

  const handleSave = async () => {
    setSaving(true)
    try {
      if (user && displayName) {
        await supabaseAny.from('user_profiles').update({ display_name: displayName }).eq('id', user.id)
      }
      await upsert.mutateAsync({
        currency,
        theme,
        expense_categories: expenseCats,
        income_categories:  incomeCats,
      })
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

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return
    setImporting(true)
    setImportResult(null)
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

  return (
    <div className="space-y-6 max-w-xl mx-auto pb-12 lg:pt-2">
      <header>
        <h1 className="text-2xl font-display text-text flex items-center gap-2">
          <Settings size={24} /> Settings
        </h1>
      </header>

      {/* Account */}
      <section className="bg-surface border border-border rounded-2xl p-5 space-y-4">
        <h2 className="text-xs font-medium text-text-muted uppercase tracking-wider flex items-center gap-2">
          <User size={14} /> Account
        </h2>
        <div>
          <label className="block text-xs text-text-muted mb-1.5 uppercase tracking-wider">Display Name</label>
          <input
            type="text"
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            className="w-full bg-surface-2 border border-border rounded-xl px-4 py-3 text-text focus:border-accent focus:outline-none"
          />
        </div>
        <div className="flex items-center justify-between p-3 bg-surface-2 rounded-xl border border-border">
          <div className="min-w-0 flex-1 mr-3">
            <p className="text-sm font-medium text-text">Email</p>
            <p className="text-xs text-text-muted truncate">{user?.email}</p>
          </div>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-danger/10 text-danger text-xs font-medium rounded-lg hover:bg-danger/20 transition-colors flex-shrink-0"
          >
            <LogOut size={13} />
            Sign Out
          </button>
        </div>
      </section>

      {/* Appearance */}
      <section className="bg-surface border border-border rounded-2xl p-5 space-y-4">
        <h2 className="text-xs font-medium text-text-muted uppercase tracking-wider">Appearance</h2>
        <div className="flex gap-3">
          <button
            onClick={() => setTheme('dark')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-medium transition-all ${
              theme === 'dark' ? 'bg-surface-2 border-accent text-accent' : 'border-border text-text-muted hover:text-text hover:border-text-muted'
            }`}
          >
            <Moon size={16} /> Dark
          </button>
          <button
            onClick={() => setTheme('light')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-medium transition-all ${
              theme === 'light' ? 'bg-surface-2 border-accent text-accent' : 'border-border text-text-muted hover:text-text hover:border-text-muted'
            }`}
          >
            <Sun size={16} /> Light
          </button>
        </div>
      </section>

      {/* Notifications */}
      {pushSupported && (
        <section className="bg-surface border border-border rounded-2xl p-5 space-y-4">
          <h2 className="text-xs font-medium text-text-muted uppercase tracking-wider flex items-center gap-2">
            <Bell size={14} /> Notifications
          </h2>
          <div className="flex items-center justify-between p-3 bg-surface-2 rounded-xl border border-border">
            <div className="min-w-0 flex-1 mr-3">
              <p className="text-sm font-medium text-text">Push Notifications</p>
              <p className="text-xs text-text-muted">Daily reminders & updates</p>
            </div>
            <button
              onClick={handleTogglePush}
              disabled={pushLoading}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors disabled:opacity-50 flex-shrink-0 ${
                pushEnabled
                  ? 'bg-danger/10 text-danger hover:bg-danger/20'
                  : 'bg-accent/10 text-accent hover:bg-accent/20'
              }`}
            >
              {pushLoading && <Loader size={13} className="animate-spin" />}
              {pushEnabled ? 'Disable' : 'Enable'}
            </button>
          </div>
          {pushError && (
            <div className="flex items-start gap-2 p-3 bg-warning/10 border border-warning/20 rounded-xl text-xs text-warning">
              <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
              {pushError}
            </div>
          )}
        </section>
      )}

      {/* Finance */}
      <section className="bg-surface border border-border rounded-2xl p-5 space-y-4">
        <h2 className="text-xs font-medium text-text-muted uppercase tracking-wider">Finance</h2>
        <div>
          <label className="block text-xs text-text-muted mb-1.5 uppercase tracking-wider">Currency</label>
          <select
            value={currency}
            onChange={e => setCurrency(e.target.value)}
            className="w-full bg-surface-2 border border-border rounded-xl px-4 py-3 text-text focus:border-accent focus:outline-none appearance-none text-sm"
          >
            {['USD','EUR','GBP','XOF','NGN','GHS','JPY','INR','CAD','AUD'].map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <CategoryEditor label="Expense Categories" categories={expenseCats} onChange={setExpenseCats} />
        <CategoryEditor label="Income Categories"  categories={incomeCats}  onChange={setIncomeCats}  />
      </section>

      {/* Navigation */}
      <section className="bg-surface border border-border rounded-2xl p-5 space-y-4">
        <h2 className="text-xs font-medium text-text-muted uppercase tracking-wider flex items-center gap-2">
          <Layout size={14} /> Navigation
        </h2>
        <p className="text-xs text-text-muted leading-relaxed">
          Home is always the first tab. Pick up to 4 more slots. Pages not in the nav stay reachable via the ☰ menu.
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
                    if (navItems.length >= 4) {
                      setNavItems([...navItems.slice(0, 3), opt.key])
                    } else {
                      setNavItems([...navItems, opt.key])
                    }
                  }
                }}
                className={clsx(
                  'flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all',
                  selected
                    ? 'bg-accent/10 border-accent text-accent'
                    : 'bg-surface-2 border-border text-text-muted hover:text-text hover:border-text-muted'
                )}
              >
                <Icon size={16} />
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
        <p className="text-[11px] text-text-muted">{navItems.length}/4 slots · Home is always slot 1</p>
      </section>

      {/* Quote interval */}
      <section className="bg-surface border border-border rounded-2xl p-5 space-y-4">
        <h2 className="text-xs font-medium text-text-muted uppercase tracking-wider flex items-center gap-2">
          <Quote size={14} /> Quote Widget
        </h2>
        <p className="text-xs text-text-muted">How often the dashboard quote rotates automatically.</p>
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
      </section>

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full py-3.5 bg-accent text-bg font-medium rounded-xl hover:bg-accent-dim transition-colors disabled:opacity-50"
      >
        {saving ? 'Saving…' : 'Save All Changes'}
      </button>

      {/* Data */}
      <section className="bg-surface border border-border rounded-2xl p-5 space-y-5">
        <h2 className="text-xs font-medium text-text-muted uppercase tracking-wider flex items-center gap-2">
          <Download size={14} /> Your Data
        </h2>
        <div className="space-y-2">
          <p className="text-xs text-text-muted font-medium uppercase tracking-wider">Export</p>
          <div className="flex gap-3">
            <button onClick={exportAllDataToJson}
              className="flex-1 py-3 bg-surface-2 text-text font-medium text-sm rounded-xl hover:bg-muted border border-border transition-colors flex items-center justify-center gap-2">
              <Download size={14} /> JSON Backup
            </button>
            <button onClick={exportTransactionsCSV}
              className="flex-1 py-3 bg-surface-2 text-text font-medium text-sm rounded-xl hover:bg-muted border border-border transition-colors flex items-center justify-center gap-2">
              <Download size={14} /> Finance CSV
            </button>
          </div>
        </div>

        <div className="space-y-3 border-t border-border pt-5">
          <p className="text-xs text-text-muted font-medium uppercase tracking-wider">Import</p>
          <p className="text-xs text-text-muted leading-relaxed">
            Accepts any Life OS JSON backup — old or new format. Records with matching IDs are skipped.
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
            <div className={`flex items-start gap-3 p-4 rounded-xl text-sm ${importResult.ok ? 'bg-success/10 border border-success/20 text-success' : 'bg-danger/10 border border-danger/20 text-danger'}`}>
              {importResult.ok
                ? <CheckCircle size={16} className="flex-shrink-0 mt-0.5" />
                : <XCircle size={16} className="flex-shrink-0 mt-0.5" />
              }
              <span>{importResult.message}</span>
            </div>
          )}
          {importResult?.ok && (
            <button onClick={() => window.location.reload()}
              className="w-full py-2.5 bg-accent text-bg font-medium text-sm rounded-xl hover:bg-accent-dim transition-colors">
              Reload to see imported data
            </button>
          )}
        </div>
      </section>

      {/* Danger Zone */}
      <section className="p-5 border border-danger/30 bg-danger/5 rounded-2xl space-y-3">
        <h2 className="text-sm font-medium text-danger flex items-center gap-2">
          <AlertTriangle size={16} /> Danger Zone
        </h2>
        <p className="text-xs text-danger/80">Clears the local offline cache. Data re-fetches from the cloud on next load.</p>
        <button
          onClick={() => { if (window.confirm('Clear local cache?')) db.delete().then(() => window.location.reload()) }}
          className="px-4 py-2 bg-danger/10 text-danger text-xs font-medium rounded-lg hover:bg-danger/20 transition-colors"
        >
          Reset Local Cache
        </button>
      </section>
    </div>
  )
}
