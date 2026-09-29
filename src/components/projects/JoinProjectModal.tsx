import { useState, type FormEvent } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { KeyRound, X, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { redeemShareCode } from '../../lib/share'
import { supabase } from '../../lib/supabase'
import { useDb } from '../../db/DbContext'
import { useAuth } from '../../hooks/useAuth'
import { queryClient } from '../../lib/queryClient'
import { QK } from '../../lib/queryKeys'
import type { Project } from '../../db/schema'

export interface JoinProjectModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: (projectId: string) => void
}

export function JoinProjectModal({ isOpen, onClose, onSuccess }: JoinProjectModalProps) {
  const db = useDb()
  const { user } = useAuth()
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleJoin = async (e: FormEvent) => {
    e.preventDefault()
    const cleanCode = code.trim().toUpperCase()
    if (!cleanCode) return

    setLoading(true)
    setError(null)

    try {
      const shared = await redeemShareCode(cleanCode)

      if (shared.item_type !== 'project') {
        throw new Error('This share code is not for a project')
      }

      // Fetch the shared project record from Supabase and cache it locally in Dexie
      const { data: projData, error: projErr } = await supabase
        .from('projects')
        .select('*')
        .eq('id', shared.item_id)
        .single()

      if (projErr) {
        console.warn('[JoinProjectModal] Error fetching joined project:', projErr)
      } else if (projData) {
        await db.projects.put(projData as Project)
      }

      if (user?.id) {
        await queryClient.invalidateQueries({ queryKey: QK.projects(user.id) })
      }

      setSuccess(true)
      setTimeout(() => {
        setSuccess(false)
        setCode('')
        onSuccess?.(shared.item_id)
        onClose()
      }, 1000)
    } catch (err: any) {
      console.error('[JoinProjectModal] redeem error:', err)
      setError(err?.message || 'Invalid or expired share code')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (loading) return
    setError(null)
    setSuccess(false)
    setCode('')
    onClose()
  }

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-bg/80 backdrop-blur-sm animate-in fade-in duration-200" />
        <Dialog.Content
          className="fixed bottom-0 left-0 right-0 z-50 bg-surface border-t border-border rounded-t-3xl p-5 shadow-2xl overflow-y-auto max-h-[85vh] sm:inset-auto sm:left-1/2 sm:-translate-x-1/2 sm:top-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-md sm:rounded-2xl sm:border animate-in slide-in-from-bottom sm:zoom-in-95 duration-200"
          style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
        >
          <div className="w-10 h-1 rounded-full bg-border mx-auto mb-4 sm:hidden" />

          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                <KeyRound size={18} />
              </div>
              <div>
                <Dialog.Title className="text-base font-semibold text-text">
                  Join with Code
                </Dialog.Title>
                <Dialog.Description className="text-xs text-text-muted mt-0.5">
                  Enter an invite code to join a collaborative project
                </Dialog.Description>
              </div>
            </div>
            <Dialog.Close
              onClick={handleClose}
              disabled={loading}
              className="p-2 rounded-full hover:bg-surface-2 text-text-muted hover:text-text transition-colors disabled:opacity-50"
              aria-label="Close"
            >
              <X size={16} />
            </Dialog.Close>
          </div>

          <form onSubmit={handleJoin} className="space-y-4">
            {error && (
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-danger/10 border border-danger/20 text-danger text-xs animate-in fade-in duration-150">
                <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                <span className="leading-relaxed">{error}</span>
              </div>
            )}

            {success && (
              <div className="flex items-center gap-2.5 p-3 rounded-xl bg-success/10 border border-success/20 text-success text-xs animate-in fade-in duration-150">
                <CheckCircle2 size={16} className="flex-shrink-0" />
                <span className="font-medium">Successfully joined project! Loading...</span>
              </div>
            )}

            <div>
              <label className="block text-[10px] font-bold text-text-secondary mb-2 uppercase tracking-wider">
                Invite Code
              </label>
              <input
                autoFocus
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="SHARE-XXXXXX"
                disabled={loading || success}
                className="w-full bg-surface-2 border border-border focus:border-accent rounded-xl px-4 py-2.5 text-sm text-text placeholder-text-muted focus:outline-none transition-colors font-mono tracking-wider disabled:opacity-50 uppercase"
              />
              <p className="text-[11px] text-text-muted mt-1.5">
                Paste the invite code shared with you by the project owner.
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleClose}
                disabled={loading}
                className="flex-1 py-2.5 px-4 rounded-xl border border-border text-xs font-semibold text-text hover:bg-surface-2 transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!code.trim() || loading || success}
                className="flex-1 py-2.5 px-4 rounded-xl bg-accent text-bg text-xs font-semibold hover:bg-accent-dim active:scale-[0.99] transition-all disabled:opacity-50 shadow-sm flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Joining...</span>
                  </>
                ) : success ? (
                  <>
                    <CheckCircle2 size={14} />
                    <span>Joined</span>
                  </>
                ) : (
                  'Join Project'
                )}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
