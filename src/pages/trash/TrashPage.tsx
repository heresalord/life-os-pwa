import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Trash2, RotateCcw, ArrowLeft, FileText, CheckCircle2 } from 'lucide-react'
import { useDb } from '../../db/DbContext'
import { useAuth } from '../../hooks/useAuth'
import { useQuery } from '@tanstack/react-query'
import { useNoteMutations } from '../../hooks/useNoteMutations'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import type { Note } from '../../db/schema'

export function TrashPage() {
  const navigate = useNavigate()
  const db = useDb()
  const { user } = useAuth()
  const { restoreNote, permanentDeleteNote } = useNoteMutations()

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Fetch soft-deleted notes from Dexie
  const { data: deletedNotes = [], isLoading, refetch } = useQuery({
    queryKey: ['trash', 'notes', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const all = await db.notes.toArray()
      return all
        .filter(n => !!n.deleted_at)
        .sort((a, b) => new Date(b.deleted_at!).getTime() - new Date(a.deleted_at!).getTime())
    },
  })

  const handleRestore = async (note: Note) => {
    await restoreNote.mutateAsync(note.id)
    setSuccessMsg(`Restored "${note.title || 'Untitled'}"`)
    setTimeout(() => setSuccessMsg(null), 3000)
    void refetch()
  }

  const handlePermanentDelete = async () => {
    if (!confirmDeleteId) return
    await permanentDeleteNote.mutateAsync(confirmDeleteId)
    setConfirmDeleteId(null)
    setSuccessMsg('Note permanently deleted')
    setTimeout(() => setSuccessMsg(null), 3000)
    void refetch()
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-xl text-text-muted hover:text-text hover:bg-surface border border-border transition-colors"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-text">Trash</h1>
            <p className="text-xs text-text-muted">
              Deleted notes are kept for 30 days before being automatically purged.
            </p>
          </div>
        </div>
      </div>

      {successMsg && (
        <div className="p-3 bg-success/10 border border-success/30 rounded-xl text-xs text-success flex items-center gap-2">
          <CheckCircle2 size={14} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Note list */}
      {isLoading ? (
        <div className="p-12 text-center text-xs text-text-muted">Loading trash…</div>
      ) : deletedNotes.length === 0 ? (
        <div className="p-12 bg-surface border border-border rounded-2xl text-center space-y-2">
          <div className="w-10 h-10 rounded-full bg-surface-2 flex items-center justify-center mx-auto text-text-muted">
            <Trash2 size={20} />
          </div>
          <p className="text-sm font-medium text-text">Trash is empty</p>
          <p className="text-xs text-text-muted">Items you delete will show up here.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {deletedNotes.map(note => {
            const deletedDate = note.deleted_at
              ? new Date(note.deleted_at).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : 'Unknown date'

            return (
              <div
                key={note.id}
                className="p-4 bg-surface border border-border rounded-2xl flex items-center justify-between gap-4 hover:border-border/80 transition-colors"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <FileText size={15} className="text-text-muted flex-shrink-0" />
                    <h3 className="text-sm font-medium text-text truncate">
                      {note.title || 'Untitled'}
                    </h3>
                  </div>
                  <p className="text-xs text-text-muted line-clamp-1">
                    {note.content?.replace(/<[^>]*>/g, '').trim() || 'No preview text'}
                  </p>
                  <p className="text-[11px] text-text-muted/80">Deleted {deletedDate}</p>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleRestore(note)}
                    title="Restore note"
                    className="p-2 rounded-xl bg-accent/10 border border-accent/20 text-accent hover:bg-accent/20 text-xs font-medium flex items-center gap-1.5 transition-colors"
                  >
                    <RotateCcw size={14} />
                    <span>Restore</span>
                  </button>

                  <button
                    onClick={() => setConfirmDeleteId(note.id)}
                    title="Delete forever"
                    className="p-2 rounded-xl bg-danger/10 border border-danger/20 text-danger hover:bg-danger/20 text-xs font-medium flex items-center gap-1.5 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Confirmation dialog for permanent delete */}
      <ConfirmDialog
        open={!!confirmDeleteId}
        title="Delete Permanently?"
        message="This note will be permanently erased from your device and the cloud. This action cannot be undone."
        confirmLabel="Delete Forever"
        danger
        onConfirm={handlePermanentDelete}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </div>
  )
}
