import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useUserSettings } from '../../hooks/useUserSettings'
import { exportAllDataToCSV, exportTransactionsCSV } from '../../lib/exportUtils'
import { db } from '../../db'
import { Settings, LogOut, Download, Upload, AlertTriangle, User, CheckCircle, XCircle } from 'lucide-react'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabaseAny = supabase as any

const TABLES = [
  'daily_records', 'tasks', 'transactions',
  'goals', 'goal_events', 'books', 'quotes',
  'agenda_blocks', 'inbox_items', 'notes'
]

export function SettingsPage() {
  const { user } = useAuth()
  const { data: settings, upsert } = useUserSettings()

  const [budget, setBudget] = useState(settings?.daily_budget?.toString() || '100')
  const [currency, setCurrency] = useState(settings?.currency || 'USD')
  const [saving, setSaving] = useState(false)

  // Import state
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
      const payload: any = JSON.parse(raw)

      // Validate it's a Life OS export
      if (!payload.schema_version || !payload.data) {
        throw new Error('This doesn\'t look like a Life OS backup file.')
      }
      if (payload.schema_version !== 1) {
        throw new Error(`Unsupported backup version: ${payload.schema_version}`)
      }

      let totalImported = 0

      for (const table of TABLES) {
        const rows = payload.data[table] ?? []
        if (!rows.length) continue

        // Re-map user_id to current user
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const remapped = rows.map((row: any) => ({ ...row, user_id: user.id }))

        // Upsert in batches of 200
        for (let i = 0; i < remapped.length; i += 200) {
          const batch = remapped.slice(i, i + 200)
          const { error } = await supabaseAny.from(table).upsert(batch, {
            onConflict: 'id',
            ignoreDuplicates: true
          })
          if (error) console.warn(`Import warning for ${table}:`, error.message)
          else totalImported += batch.length
        }
      }

      setImportResult({ ok: true, message: `Imported ${totalImported} records successfully. Refresh to see your data.` })
    } catch (err) {
      setImportResult({ ok: false, message: err instanceof Error ? err.message : 'Import failed.' })
    } finally {
      setImporting(false)
      // Reset file input
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
          <button onClick={handleSignOut} className="px-4 py-2 bg-danger/10 text-danger text-xs font-medium rounded-lg hover:bg-danger/20 transition-colors flex items-center gap-2">
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

      {/* Data Export & Import */}
      <section className="bg-surface border border-border rounded-2xl p-5 space-y-4">
        <h2 className="text-sm font-medium text-text uppercase tracking-wider flex items-center gap-2">
          <Download size={16} /> Data
        </h2>
        <p className="text-sm text-text-secondary">Your life belongs to you — export or restore anytime.</p>

        {/* Export */}
        <div className="space-y-2">
          <p className="text-xs text-text-muted uppercase tracking-wider">Export</p>
          <div className="flex gap-3">
            <button onClick={exportAllDataToCSV}
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
        <div className="space-y-2 border-t border-border pt-4">
          <p className="text-xs text-text-muted uppercase tracking-wider">Import</p>
          <p className="text-xs text-text-muted leading-relaxed">
            Restore from a Life OS JSON backup. Existing records with matching IDs won't be overwritten.
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleImport}
            className="hidden"
            id="import-file-input"
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="w-full py-3 bg-surface-2 text-text font-medium text-sm rounded-xl hover:bg-muted border border-border transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {importing
              ? <><RefreshCwIcon className="animate-spin" size={14} /> Importing…</>
              : <><Upload size={14} /> Import JSON Backup</>
            }
          </button>

          {importResult && (
            <div className={`flex items-start gap-3 p-3 rounded-xl text-sm ${importResult.ok ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>
              {importResult.ok
                ? <CheckCircle size={16} className="flex-shrink-0 mt-0.5" />
                : <XCircle size={16} className="flex-shrink-0 mt-0.5" />}
              <span>{importResult.message}</span>
            </div>
          )}
        </div>
      </section>

      {/* Danger Zone */}
      <section className="p-5 border border-danger/30 bg-danger/5 rounded-2xl space-y-3">
        <h2 className="text-sm font-medium text-danger flex items-center gap-2">
          <AlertTriangle size={16} /> Danger Zone
        </h2>
        <p className="text-xs text-danger/80">Clears the offline cache. Data will be re-fetched from the cloud on next load.</p>
        <button
          onClick={() => { if (window.confirm('Clear local cache?')) { db.delete().then(() => window.location.reload()) } }}
          className="px-4 py-2 bg-danger/10 text-danger text-xs font-medium rounded-lg hover:bg-danger/20 transition-colors">
          Reset Local Cache
        </button>
      </section>
    </div>
  )
}

// Inline icon to avoid import issues
function RefreshCwIcon({ size, className }: { size: number, className?: string }) {
  return <Upload size={size} className={className} />
}
