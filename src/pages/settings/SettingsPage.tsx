import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useUserSettings } from '../../hooks/useUserSettings'
import { exportAllDataToJson, exportTransactionsCSV } from '../../lib/exportUtils'
import { db } from '../../db'
import { Settings, LogOut, Download, Upload, AlertTriangle, User, CheckCircle, XCircle, Loader } from 'lucide-react'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabaseAny = supabase as any
type AnyRow = Record<string, unknown>

const TABLES = [
  'daily_records', 'tasks', 'transactions',
  'goals', 'goal_events', 'books', 'quotes',
  'agenda_blocks', 'inbox_items', 'notes'
]

// ─── Schema transformer ────────────────────────────────────────────────────
// Handles both the new format ({ schema_version, data: { tasks, ... } })
// and the old format (flat root-level { tasks, notes, ... })

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function transformPayload(raw: any, userId: string): Record<string, AnyRow[]> {
  // Detect format
  const isNewFormat = raw.schema_version === 1 && raw.data
  const source = isNewFormat ? raw.data : raw

  const result: Record<string, AnyRow[]> = {}

  // ── tasks ──────────────────────────────────────────────────────────────
  result.tasks = (source.tasks ?? []).map((r: AnyRow) => ({
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
    created_at: r.created_at ?? new Date().toISOString(),
  }))

  // ── notes ──────────────────────────────────────────────────────────────
  // Old format had template: "free" — map to null (freewrite)
  result.notes = (source.notes ?? []).map((r: AnyRow) => ({
    id: r.id,
    user_id: userId,
    date: r.date,
    title: r.title ?? 'Note',
    content: r.content ?? '',
    template: r.template === 'free' || r.template === 'freewrite' ? null
      : r.template === 'morning' ? 'morning'
      : r.template === 'night' ? 'night'
      : null,
    created_at: r.created_at ?? new Date().toISOString(),
    updated_at: r.updated_at ?? new Date().toISOString(),
  }))

  // ── agenda_blocks ──────────────────────────────────────────────────────
  // Old format had: title (→ description), type (dropped — not in schema)
  result.agenda_blocks = (source.agenda_blocks ?? []).map((r: AnyRow) => ({
    id: r.id,
    user_id: userId,
    date: r.date,
    start_time: r.start_time,
    end_time: r.end_time,
    // Old format used 'title', new schema uses 'description'
    description: (r.description ?? r.title ?? 'Block') as string,
    created_at: r.created_at ?? new Date().toISOString(),
  }))

  // ── goals ──────────────────────────────────────────────────────────────
  // Old format had: frequency, no goal_type/measurement_type/is_completed
  result.goals = (source.goals ?? []).map((r: AnyRow) => ({
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
    created_at: r.created_at ?? new Date().toISOString(),
    updated_at: r.updated_at ?? new Date().toISOString(),
    // 'frequency' is dropped — not in current schema
  }))

  // ── daily_records ──────────────────────────────────────────────────────
  // Old format missing mood, reflections, created_at
  result.daily_records = (source.daily_records ?? []).map((r: AnyRow) => ({
    id: r.id,
    user_id: userId,
    date: r.date,
    mood: r.mood ?? null,
    intent: r.intent ?? null,
    reflections: r.reflections ?? {},
    created_at: r.created_at ?? r.updated_at ?? new Date().toISOString(),
    updated_at: r.updated_at ?? new Date().toISOString(),
  }))

  // ── transactions (pass through) ────────────────────────────────────────
  result.transactions = (source.transactions ?? []).map((r: AnyRow) => ({
    ...r,
    user_id: userId,
  }))

  // ── goal_events (pass through) ─────────────────────────────────────────
  result.goal_events = (source.goal_events ?? []).map((r: AnyRow) => ({
    ...r,
    user_id: userId,
  }))

  // ── books (pass through) ───────────────────────────────────────────────
  result.books = (source.books ?? []).map((r: AnyRow) => ({
    ...r,
    user_id: userId,
  }))

  // ── quotes (pass through) ──────────────────────────────────────────────
  result.quotes = (source.quotes ?? []).map((r: AnyRow) => ({
    ...r,
    user_id: userId,
  }))

  // ── inbox_items ────────────────────────────────────────────────────────
  result.inbox_items = (source.inbox_items ?? []).map((r: AnyRow) => ({
    id: r.id,
    user_id: userId,
    text: r.text,
    type: r.type ?? 'thought',
    processed: r.processed ?? false,
    processed_at: r.processed_at ?? null,
    processed_to: r.processed_to ?? null,
    archived_at: r.archived_at ?? null,
    captured_at: r.captured_at ?? new Date().toISOString(),
  }))

  return result
}

// ─── Settings Page ─────────────────────────────────────────────────────────

export function SettingsPage() {
  const { user } = useAuth()
  const { data: settings, upsert } = useUserSettings()

  const [budget, setBudget] = useState(settings?.daily_budget?.toString() || '100')
  const [currency, setCurrency] = useState(settings?.currency || 'USD')
  const [saving, setSaving] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ ok: boolean; message: string } | null>(null)

  useEffect(() => {
    if (settings) {
      setBudget(settings.daily_budget?.toString() || '100')
      setCurrency(settings.currency || 'USD')
    }
  }, [settings])

  const handleSave = async () => {
    setSaving(true)
    await upsert.mutateAsync({ daily_budget: parseFloat(budget) || 100, currency })
    setSaving(false)
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
      const raw = await file.text()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const parsed: any = JSON.parse(raw)

      // Basic sanity check — must have at least one known key
      const knownKeys = ['tasks', 'notes', 'goals', 'agenda_blocks', 'daily_records', 'inbox_items', 'data']
      const hasKnownKey = knownKeys.some(k => k in parsed)
      if (!hasKnownKey) {
        throw new Error("This doesn't look like a Life OS backup file.")
      }

      // Transform to current schema
      const transformed = transformPayload(parsed, user.id)

      let totalImported = 0
      const warnings: string[] = []

      for (const table of TABLES) {
        const rows = transformed[table] ?? []
        if (!rows.length) continue

        for (let i = 0; i < rows.length; i += 200) {
          const batch = rows.slice(i, i + 200)
          const { error } = await supabaseAny.from(table).upsert(batch, {
            onConflict: 'id',
            ignoreDuplicates: true
          })
          if (error) {
            warnings.push(`${table}: ${error.message}`)
            console.warn(`Import warning [${table}]:`, error)
          } else {
            totalImported += batch.length
          }
        }
      }

      const msg = warnings.length
        ? `Imported ${totalImported} records. Some skipped: ${warnings.join('; ')}`
        : `Imported ${totalImported} records successfully. Reload the page to see your data.`

      setImportResult({ ok: true, message: msg })
    } catch (err) {
      setImportResult({
        ok: false,
        message: err instanceof Error ? err.message : 'Import failed — check the file and try again.'
      })
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
        <p className="text-sm text-text-secondary mt-1">Manage your account and preferences.</p>
      </header>

      {/* Account */}
      <section className="bg-surface border border-border rounded-2xl p-5 space-y-4">
        <h2 className="text-sm font-medium text-text uppercase tracking-wider flex items-center gap-2">
          <User size={16} /> Account
        </h2>
        <div className="flex items-center justify-between p-3 bg-surface-2 rounded-xl">
          <div className="min-w-0">
            <p className="text-sm font-medium text-text">Signed in as</p>
            <p className="text-xs text-text-muted truncate">{user?.email}</p>
          </div>
          <button onClick={handleSignOut}
            className="px-4 py-2 bg-danger/10 text-danger text-xs font-medium rounded-lg hover:bg-danger/20 transition-colors flex items-center gap-2">
            <LogOut size={14} /> Sign Out
          </button>
        </div>
      </section>

      {/* Preferences */}
      <section className="bg-surface border border-border rounded-2xl p-5 space-y-4">
        <h2 className="text-sm font-medium text-text uppercase tracking-wider">Preferences</h2>
        <div>
          <label className="block text-xs text-text-muted mb-1.5 uppercase tracking-wider">Daily Budget</label>
          <input type="number" value={budget} onChange={e => setBudget(e.target.value)}
            className="w-full bg-surface-2 border border-border rounded-xl px-4 py-3 text-text focus:border-accent focus:outline-none" />
        </div>
        <div>
          <label className="block text-xs text-text-muted mb-1.5 uppercase tracking-wider">Currency</label>
          <select value={currency} onChange={e => setCurrency(e.target.value)}
            className="w-full bg-surface-2 border border-border rounded-xl px-4 py-3 text-text focus:border-accent focus:outline-none appearance-none">
            <option value="USD">USD ($)</option>
            <option value="EUR">EUR (€)</option>
            <option value="GBP">GBP (£)</option>
            <option value="XOF">XOF (CFA)</option>
            <option value="NGN">NGN (₦)</option>
            <option value="GHS">GHS (₵)</option>
            <option value="JPY">JPY (¥)</option>
            <option value="INR">INR (₹)</option>
            <option value="CAD">CAD ($)</option>
            <option value="AUD">AUD ($)</option>
          </select>
        </div>
        <button onClick={handleSave} disabled={saving}
          className="w-full py-3 bg-accent text-bg font-medium rounded-xl hover:bg-accent-dim transition-colors disabled:opacity-50">
          {saving ? 'Saving…' : 'Save Preferences'}
        </button>
      </section>

      {/* Data */}
      <section className="bg-surface border border-border rounded-2xl p-5 space-y-5">
        <h2 className="text-sm font-medium text-text uppercase tracking-wider flex items-center gap-2">
          <Download size={16} /> Your Data
        </h2>
        <p className="text-sm text-text-secondary">Your life belongs to you — export or restore anytime.</p>

        {/* Export */}
        <div className="space-y-2">
          <p className="text-xs text-text-muted uppercase tracking-wider font-medium">Export</p>
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

        {/* Import */}
        <div className="space-y-3 border-t border-border pt-5">
          <p className="text-xs text-text-muted uppercase tracking-wider font-medium">Import</p>
          <p className="text-xs text-text-muted leading-relaxed">
            Accepts any Life OS JSON backup — old or new format. Records with matching IDs are skipped.
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleImport}
            className="hidden"
          />

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
            <div className={`flex items-start gap-3 p-4 rounded-xl text-sm leading-relaxed ${
              importResult.ok ? 'bg-success/10 border border-success/20 text-success' : 'bg-danger/10 border border-danger/20 text-danger'
            }`}>
              {importResult.ok
                ? <CheckCircle size={16} className="flex-shrink-0 mt-0.5" />
                : <XCircle size={16} className="flex-shrink-0 mt-0.5" />}
              <span>{importResult.message}</span>
            </div>
          )}

          {importResult?.ok && (
            <button
              onClick={() => window.location.reload()}
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
          onClick={() => {
            if (window.confirm('Clear local cache? Data will reload from Supabase.')) {
              db.delete().then(() => window.location.reload())
            }
          }}
          className="px-4 py-2 bg-danger/10 text-danger text-xs font-medium rounded-lg hover:bg-danger/20 transition-colors">
          Reset Local Cache
        </button>
      </section>
    </div>
  )
}
