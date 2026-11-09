import React, { useState } from 'react'
import { History, RotateCcw, X, Clock, FileText } from 'lucide-react'
import { useNoteVersions } from '../../hooks/useNoteVersions'
import type { NoteVersion } from '../../db/schema'

interface Props {
  open: boolean
  noteId: string
  noteTitle: string
  onClose: () => void
  onRestore: (version: NoteVersion) => void
}

export function NoteVersionHistoryModal({
  open,
  noteId,
  noteTitle,
  onClose,
  onRestore,
}: Props) {
  const { data: versions = [], isLoading } = useNoteVersions(open ? noteId : undefined)
  const [selectedVersion, setSelectedVersion] = useState<NoteVersion | null>(null)

  if (!open) return null

  const active = selectedVersion || versions[0] || null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center text-accent">
              <History size={16} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-text">Version History</h2>
              <p className="text-xs text-text-muted truncate max-w-xs">{noteTitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-surface-2 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-5 min-h-[350px]">
          {/* Version list */}
          <div className="md:col-span-2 border-r border-border overflow-y-auto p-3 space-y-1.5 bg-surface/50">
            <div className="text-[11px] font-medium text-text-muted uppercase tracking-wider px-2 py-1">
              Past Revisions ({versions.length})
            </div>

            {isLoading && (
              <div className="p-4 text-center text-xs text-text-muted">Loading revisions…</div>
            )}

            {!isLoading && versions.length === 0 && (
              <div className="p-4 text-center text-xs text-text-muted">
                No previous snapshots recorded yet. Revisions are captured every 5 minutes during active edits.
              </div>
            )}

            {versions.map((ver) => {
              const isSelected = active?.id === ver.id
              const dateStr = new Date(ver.created_at).toLocaleString(undefined, {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })
              const words = ver.content ? ver.content.trim().split(/\s+/).length : 0

              return (
                <button
                  key={ver.id}
                  onClick={() => setSelectedVersion(ver)}
                  className={`w-full text-left p-2.5 rounded-xl border transition-all text-xs flex flex-col gap-1 ${
                    isSelected
                      ? 'bg-accent/10 border-accent text-accent font-medium'
                      : 'bg-surface border-border hover:bg-surface-2 text-text-secondary'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <Clock size={12} className="opacity-70 flex-shrink-0" />
                    <span>{dateStr}</span>
                  </div>
                  <div className="text-[11px] text-text-muted truncate flex items-center gap-1">
                    <FileText size={10} />
                    <span>{words} words</span>
                  </div>
                </button>
              )
            })}
          </div>

          {/* Preview panel */}
          <div className="md:col-span-3 flex flex-col p-4 overflow-y-auto">
            {active ? (
              <div className="flex flex-col h-full">
                <div className="flex items-center justify-between pb-3 border-b border-border/60 mb-3">
                  <div>
                    <div className="text-xs font-semibold text-text">
                      Snapshot from {new Date(active.created_at).toLocaleString()}
                    </div>
                    <div className="text-[11px] text-text-muted">
                      Title: <span className="text-text">{active.title}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      onRestore(active)
                      onClose()
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-accent text-white text-xs font-medium hover:bg-accent/90 transition-colors shadow-sm"
                  >
                    <RotateCcw size={13} />
                    Restore
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto text-xs text-text-secondary whitespace-pre-wrap font-mono p-3 bg-surface-2 rounded-xl border border-border/50 max-h-[260px]">
                  {active.content || '(Empty content)'}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-xs text-text-muted">
                Select a revision to preview
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-border bg-surface-2/40 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs text-text-secondary hover:text-text hover:bg-surface-2 transition-colors font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
