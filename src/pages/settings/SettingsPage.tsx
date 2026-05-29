import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useUserSettings } from '../../hooks/useUserSettings'
import { exportAllDataToJson, exportTransactionsCSV } from '../../lib/exportUtils'
import { db } from '../../db'
import { useAppStore } from '../../store/useAppStore'
import type { Theme } from '../../store/useAppStore'
import {
  Settings, LogOut, Download, Upload, AlertTriangle, User,
  CheckCircle, XCircle, Loader, Moon, Sun, X, Plus, Bell
} from 'lucide-react'
import { pushSupported, isPushSubscribed, subscribeToPush, unsubscribeFromPush } from '../../lib/pushNotifications'

const supabaseAny = supabase as any
type AnyRow = Record<string, unknown>

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
      created_at: r.created_at ?? r.updated_at ?? now, updated_at: r.updated_at ?? now,
    })),
    transactions: mapUser(source.transactions ?? []),
    goal_events: mapUser(source.goal_events ?? []),
    books: mapUser(source.books ?? []),
    quotes: mapUser(source.quotes ?? []),
    inbox_items: (source.inbox_items ?? []).map((r: AnyRow) => ({
      id: r.id, user_id: userId, text: r.text, type: r.type ?? 'thought',
      processed: r.processed ?? false, processed_at: r.processed_at ?? null,
      processed_to: r.processed_to ?? null, archived_at: r.archived_at ?? null,
      captured_at: r.captured_at ?? now,
    })),
  }
}

// ── Category chip editor ──────────────────────────────────────────────────
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
          <span key={cat}
            className="flex items-center gap-1 px-2.5 py-1 bg-surface-2 border border-border rounded-full text-xs text-text capitalize">
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
        <button onClick={add}
          className="px-3 py-2 bg-accent/15 text-accent rounded-lg hover:bg-accent/25 transition-colors">
          <Plus size={16} />
        </button>
      </div>
    </div>
  )
}

// ── Settings Page ──────────────────────────────────────────────────────────
export function SettingsPage() {
  const { user } = useAuth()
  const { data: settings, upsert } = useUserSettings()
  const { theme, setTheme } = useAppStore()

  const [budget, setBudget] = useState('100')
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

  useEffect(() => {
    if (pushSupported) isPushSubscribed().then(setPushEnabled)
  }, [])

  const handleTogglePush = async () => {
    if (!user) return
    setPushLoading(true)
    try {
      if (pushEnabled) {
        await unsubscribeFromPush(user.id)
        setPushEnabled(false)
      } else {
        const ok = await subscribeToPush(user.id)
        setPushEnabled(ok)
      }
    } finally {
      setPushLoading(false)
    }
  }

  useEffect(() => {
    if (settings) {
      setBudget(settings.daily_budget?.toString() || '100')
      setCurrency(settings.currency || 'USD')
      if (settings.expense_categories?.length) setExpenseCats(settings.expense_categories)
      if (settings.income_categories?.length) setIncomeCats(settings.income_categories)
    }
  }, [settings])

  useEffect(() => {
    if (user) {
      supabaseAny.from('user_profiles').select('display_name').eq('id', user.id).single()
        .then(({ data }: { data: { display_name: string } | null }) => { if (data?.display_name) setDisplayName(data.display_name) })
    }
  }, [user])

  const handleSave = async () => {
    setSaving(true)
    try {
      if (user && displayName) {
        await supabaseAny.from('user_profiles').update({ display_name: displayName }).eq('id', user.id)
      }
      await upsert.mutateAsync({
        daily_budget: parseFloat(budget) || 100,
        currency,
        theme,
        expense_categories: expenseCats,
        income_categories: incomeCats,
      })
    } finally {
      setSaving(false)
    }
  }

  const handleThemeChange = (t: Theme) => {
    setTheme(t)
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
          : `Imported ${totalImported} records. Reload to see your data.`
      })
    } catch (err) {
      setImportResult({ ok: false, message: err instanceof Error ? err.message : 'Import failed.' })
    } finally {
      setImporting(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-12">
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
          <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)}
            className="w-full bg-surface-2 border border-border rounded-xl px-4 py-3 text-text focus:border-accent focus:outline-none" />
        </div>
        <div className="flex items-center justify-between p-3 bg-surface-2 rounded-xl border border-border">
          <div className="min-w-0">
            <p className="text-sm font-medium text-text">Email</p>
            <p className="text-xs text-text-muted truncate">{user?.email}</p>
          </div>
          <button onClick={handleSignOut}
            className="px-3 py-1.5 bg-danger/10 text-danger text-xs font-medium rounded-lg hover:bg-danger/20 transition-colors flex items-center gap-1.5">
            <LogOut size={13} /> Sign Out
          </button>
        </div>
      </section>

      {/* Appearance */}
      <section className="bg-surface border border-border rounded-2xl p-5 space-y-4">
        <h2 className="text-xs font-medium text-text-muted uppercase tracking-wider">Appearance</h2>
        <div className="flex gap-3">
          <button
            onClick={() => handleThemeChange('dark')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-medium transition-all ${
              theme === 'dark'
                ? 'bg-surface-2 border-accent text-accent'
                : 'border-border text-text-muted hover:text-text hover:border-text-muted'
            }`}>
            <Moon size={16} /> Dark
          </button>
          <button
            onClick={() => handleThemeChange('light')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-medium transition-all ${
              theme === 'light'
                ? 'bg-surface-2 border-accent text-accent'
                : 'border-border text-text-muted hover:text-text hover:border-text-muted'
            }`}>
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
            <div className="min-w-0">
              <p className="text-sm font-medium text-text">Push Notifications</p>
              <p className="text-xs text-text-muted truncate">Daily reminders & updates</p>
            </div>
            <button 
              onClick={handleTogglePush} disabled={pushLoading}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50 ${
                pushEnabled 
                  ? 'bg-danger/10 text-danger hover:bg-danger/20' 
                  : 'bg-accent/10 text-accent hover:bg-accent/20'
              }`}
            >
              {pushLoading ? <Loader size={13} className="animate-spin" /> : null}
              {pushEnabled ? 'Disable' : 'Enable'}
            </button>
          </div>
        </section>
      )}

      {/* Preferences */}
      <section className="bg-surface border border-border rounded-2xl p-5 space-y-4">
        <h2 className="text-xs font-medium text-text-muted uppercase tracking-wider">Finance</h2>
        <div className="flex gap-3">
          <div className="w-28">
            <label className="block text-xs text-text-muted mb-1.5 uppercase tracking-wider">Currency</label>
            <select value={currency} onChange={e => setCurrency(e.target.value)}
              className="w-full bg-surface-2 border border-border rounded-xl px-3 py-3 text-text focus:border-accent focus:outline-none appearance-none text-sm">
              {['USD','EUR','GBP','XOF','NGN','GHS','JPY','INR','CAD','AUD'].map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-xs text-text-muted mb-1.5 uppercase tracking-wider">Daily Budget</label>
            <input type="number" value={budget} onChange={e => setBudget(e.target.value)}
              className="w-full bg-surface-2 border border-border rounded-xl px-4 py-3 text-text focus:border-accent focus:outline-none" />
          </div>
        </div>

        <CategoryEditor label="Expense Categories" categories={expenseCats} onChange={setExpenseCats} />
        <CategoryEditor label="Income Categories" categories={incomeCats} onChange={setIncomeCats} />
      </section>

      <button onClick={handleSave} disabled={saving}
        className="w-full py-3.5 bg-accent text-bg font-medium rounded-xl hover:bg-accent-dim transition-colors disabled:opacity-50">
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
          <button onClick={() => fileInputRef.current?.click()} disabled={importing}
            className="w-full py-3 bg-surface-2 text-text font-medium text-sm rounded-xl hover:bg-muted border border-border transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
            {importing ? <><Loader size={14} className="animate-spin" /> Importing…</> : <><Upload size={14} /> Import JSON Backup</>}
          </button>
          {importResult && (
            <div className={`flex items-start gap-3 p-4 rounded-xl text-sm ${importResult.ok ? 'bg-success/10 border border-success/20 text-success' : 'bg-danger/10 border border-danger/20 text-danger'}`}>
              {importResult.ok ? <CheckCircle size={16} className="flex-shrink-0 mt-0.5" /> : <XCircle size={16} className="flex-shrink-0 mt-0.5" />}
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
          className="px-4 py-2 bg-danger/10 text-danger text-xs font-medium rounded-lg hover:bg-danger/20 transition-colors">
          Reset Local Cache
        </button>
      </section>
    </div>
  )
}
