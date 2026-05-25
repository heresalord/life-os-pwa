
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useUserSettings } from '../../hooks/useUserSettings'
import { exportAllDataToCSV, exportTransactionsCSV } from '../../lib/exportUtils'
import { db } from '../../db'
import { Settings, LogOut, Download, AlertTriangle, User } from 'lucide-react'

export function SettingsPage() {
  const { user } = useAuth()
  const { data: settings, upsert } = useUserSettings()
  const navigate = useNavigate()
  
  const [budget, setBudget] = useState(settings?.daily_budget?.toString() || '100')
  const [currency, setCurrency] = useState(settings?.currency || 'USD')
  const [saving, setSaving] = useState(false)

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
    if (window.confirm('Are you sure you want to sign out? Unsynced local data will be lost.')) {
      await supabase.auth.signOut()
      await db.delete() // Clear local IndexedDB to prevent cross-account pollution
      window.location.href = '/signin'
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

      {/* Account Section */}
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

      {/* Preferences Section */}
      <section className="bg-surface border border-border rounded-2xl p-5 space-y-4">
        <h2 className="text-sm font-medium text-text uppercase tracking-wider">Preferences</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-text-muted mb-1.5 uppercase tracking-wider">Daily Budget</label>
            <input
              type="number"
              value={budget}
              onChange={e => setBudget(e.target.value)}
              className="w-full bg-surface-2 border border-border rounded-xl px-4 py-3 text-text focus:border-accent focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs text-text-muted mb-1.5 uppercase tracking-wider">Currency</label>
            <select
              value={currency}
              onChange={e => setCurrency(e.target.value)}
              className="w-full bg-surface-2 border border-border rounded-xl px-4 py-3 text-text focus:border-accent focus:outline-none appearance-none"
            >
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
              <option value="GBP">GBP (£)</option>
            </select>
          </div>

          <button onClick={handleSave} disabled={saving} className="w-full py-3 bg-accent text-bg font-medium rounded-xl hover:bg-accent-dim transition-colors disabled:opacity-50">
            {saving ? 'Saving...' : 'Save Preferences'}
          </button>
        </div>
      </section>

      {/* Data Export */}
      <section className="bg-surface border border-border rounded-2xl p-5 space-y-4">
        <h2 className="text-sm font-medium text-text uppercase tracking-wider flex items-center gap-2">
          <Download size={16} /> Data & Export
        </h2>
        <p className="text-sm text-text-secondary">Download your data. Your life belongs to you.</p>

        <div className="flex gap-3">
          <button onClick={exportAllDataToCSV} className="flex-1 py-3 bg-surface-2 text-text font-medium text-sm rounded-xl hover:bg-muted border border-border transition-colors">
            Export JSON Backup
          </button>
          <button onClick={exportTransactionsCSV} className="flex-1 py-3 bg-surface-2 text-text font-medium text-sm rounded-xl hover:bg-muted border border-border transition-colors">
            Export Finance (CSV)
          </button>
        </div>
      </section>
      
      {/* Danger Zone */}
      <section className="p-5 border border-danger/30 bg-danger/5 rounded-2xl space-y-3">
        <h2 className="text-sm font-medium text-danger flex items-center gap-2">
          <AlertTriangle size={16} /> Danger Zone
        </h2>
        <p className="text-xs text-danger/80">Resetting local data will wipe the offline database. It will be rebuilt from the cloud on next login.</p>
        <button onClick={() => { if(window.confirm('Clear local database?')) window.location.reload() }} className="px-4 py-2 bg-danger/10 text-danger text-xs font-medium rounded-lg hover:bg-danger/20 transition-colors">
          Reset Local Cache
        </button>
      </section>

    </div>
  )
}
