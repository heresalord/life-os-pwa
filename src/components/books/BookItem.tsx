import React, { useRef, useState } from 'react'
import { Trash2, Pencil, CheckCheck, BookX, ChevronDown, ChevronUp, X, BookOpen } from 'lucide-react'
import * as Dialog from '@radix-ui/react-dialog'
import { useBookMutations } from '../../hooks/useBookMutations'
import type { Book } from '../../db/schema'
import clsx from 'clsx'

// ── Finish flow ───────────────────────────────────────────────────────────
function FinishBookFlow({ book, open, onClose }: { book: Book; open: boolean; onClose: () => void }) {
  const { updateBook } = useBookMutations()
  const [step, setStep] = useState(1)
  const [q1, setQ1] = useState('')
  const [q2, setQ2] = useState('')
  const [q3, setQ3] = useState('')
  const [saving, setSaving] = useState(false)

  const minLen = 10
  const canNext = step === 1 ? q1.trim().length >= minLen
    : step === 2 ? q2.trim().length >= minLen
    : q3.trim().length >= minLen

  const handleFinish = async () => {
    setSaving(true)
    const reflection = `**What I learned:**\n${q1.trim()}\n\n**What I'll remember:**\n${q2.trim()}\n\n**Would I recommend it?**\n${q3.trim()}`
    await updateBook.mutateAsync({ id: book.id, updates: {
      status: 'finished', reflection,
      finished_at: new Date().toISOString().split('T')[0],
    }})
    setSaving(false)
    onClose()
  }

  return (
    <Dialog.Root open={open} onOpenChange={v => { if (!v) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-bg/85 backdrop-blur-sm" />
        <Dialog.Content className="fixed bottom-0 left-0 right-0 z-50 bg-surface border-t border-border rounded-t-2xl p-6 shadow-2xl sm:inset-auto sm:left-1/2 sm:-translate-x-1/2 sm:top-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-lg sm:rounded-2xl sm:border"
          style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}>
          <div className="w-10 h-1 rounded-full bg-border mx-auto mb-5 sm:hidden" />
          <div className="flex items-center justify-between mb-3">
            <Dialog.Title className="text-base font-display text-text">Finishing "{book.title}"</Dialog.Title>
            <button onClick={onClose} className="text-text-muted hover:text-text"><X size={18} /></button>
          </div>
          <div className="flex gap-1.5 mb-6">
            {[1,2,3].map(s => (
              <div key={s} className={`flex-1 h-1 rounded-full transition-all duration-300 ${s <= step ? 'bg-success' : 'bg-surface-2'}`} />
            ))}
          </div>
          <p className="text-[11px] text-text-muted uppercase tracking-wider mb-2">Question {step} of 3</p>
          {step === 1 && (
            <div className="space-y-3">
              <p className="text-lg font-display text-text">What did this book teach you?</p>
              <p className="text-sm text-text-secondary">A key idea, a new perspective, something that changed how you think.</p>
              <textarea autoFocus value={q1} onChange={e => setQ1(e.target.value)} rows={4} placeholder="Write at least a sentence…"
                className="selectable w-full bg-surface-2 border border-border rounded-xl px-4 py-3 text-text placeholder-text-muted focus:border-success focus:outline-none resize-none" />
            </div>
          )}
          {step === 2 && (
            <div className="space-y-3">
              <p className="text-lg font-display text-text">What will you remember in a year?</p>
              <p className="text-sm text-text-secondary">The one thing that will stick — a quote, a story, a concept.</p>
              <textarea autoFocus value={q2} onChange={e => setQ2(e.target.value)} rows={4} placeholder="Write at least a sentence…"
                className="selectable w-full bg-surface-2 border border-border rounded-xl px-4 py-3 text-text placeholder-text-muted focus:border-success focus:outline-none resize-none" />
            </div>
          )}
          {step === 3 && (
            <div className="space-y-3">
              <p className="text-lg font-display text-text">Would you recommend it?</p>
              <p className="text-sm text-text-secondary">To whom, and why — or why not.</p>
              <textarea autoFocus value={q3} onChange={e => setQ3(e.target.value)} rows={4} placeholder="Write at least a sentence…"
                className="selectable w-full bg-surface-2 border border-border rounded-xl px-4 py-3 text-text placeholder-text-muted focus:border-success focus:outline-none resize-none" />
            </div>
          )}
          <div className="flex gap-3 mt-5">
            {step > 1 && (
              <button onClick={() => setStep(s => s - 1)}
                className="flex-1 py-3 bg-surface-2 text-text font-medium rounded-xl hover:bg-muted transition-colors">Back</button>
            )}
            {step < 3 ? (
              <button onClick={() => setStep(s => s + 1)} disabled={!canNext}
                className="flex-[2] py-3 bg-success/20 text-success font-medium rounded-xl hover:bg-success/30 transition-colors disabled:opacity-40">Next</button>
            ) : (
              <button onClick={handleFinish} disabled={!canNext || saving}
                className="flex-[2] py-3 bg-success text-bg font-medium rounded-xl hover:bg-success/90 transition-colors disabled:opacity-40">
                {saving ? 'Saving…' : 'Mark as Finished ✓'}
              </button>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

// ── Edit modal ────────────────────────────────────────────────────────────
function EditBookModal({ book, open, onClose }: { book: Book; open: boolean; onClose: () => void }) {
  const { updateBook } = useBookMutations()
  const [title, setTitle] = useState(book.title)
  const [author, setAuthor] = useState(book.author || '')
  const [pages, setPages] = useState(book.total_pages?.toString() || '')
  const [status, setStatus] = useState(book.status)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    await updateBook.mutateAsync({ id: book.id, updates: {
      title: title.trim(),
      author: author.trim() || null,
      total_pages: pages ? parseInt(pages) : null,
      status,
      started_at: status === 'reading' && !book.started_at ? new Date().toISOString().split('T')[0] : book.started_at,
    }})
    setSaving(false)
    onClose()
  }

  return (
    <Dialog.Root open={open} onOpenChange={v => { if (!v) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-bg/85 backdrop-blur-sm" />
        <Dialog.Content className="fixed bottom-0 left-0 right-0 z-50 bg-surface border-t border-border rounded-t-2xl p-5 shadow-2xl sm:inset-auto sm:left-1/2 sm:-translate-x-1/2 sm:top-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-md sm:rounded-2xl sm:border"
          style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}>
          <div className="w-10 h-1 rounded-full bg-border mx-auto mb-4 sm:hidden" />
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-base font-medium text-text">Edit Book</Dialog.Title>
            <button onClick={onClose} className="text-text-muted hover:text-text"><X size={18} /></button>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-text-muted mb-1.5 uppercase tracking-wider">Title</label>
              <input value={title} onChange={e => setTitle(e.target.value)}
                className="selectable w-full bg-surface-2 border border-border rounded-xl px-4 py-3 text-text focus:border-accent focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1.5 uppercase tracking-wider">Author</label>
              <input value={author} onChange={e => setAuthor(e.target.value)} placeholder="Optional"
                className="selectable w-full bg-surface-2 border border-border rounded-xl px-4 py-3 text-text focus:border-accent focus:outline-none" />
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-xs text-text-muted mb-1.5 uppercase tracking-wider">Total Pages</label>
                <input type="number" min="1" value={pages} onChange={e => setPages(e.target.value)} placeholder="Optional"
                  className="selectable w-full bg-surface-2 border border-border rounded-xl px-4 py-3 text-text focus:border-accent focus:outline-none" />
              </div>
              <div className="flex-[2]">
                <label className="block text-xs text-text-muted mb-1.5 uppercase tracking-wider">Status</label>
                <select value={status} onChange={e => setStatus(e.target.value as Book['status'])}
                  className="w-full bg-surface-2 border border-border rounded-xl px-4 py-3 text-text focus:border-accent focus:outline-none appearance-none">
                  <option value="to-read">To Read</option>
                  <option value="reading">Reading</option>
                  <option value="abandoned">Abandoned</option>
                </select>
              </div>
            </div>
            <button onClick={handleSave} disabled={!title.trim() || saving}
              className="w-full py-3 bg-accent text-bg font-medium rounded-xl hover:bg-accent-dim transition-colors disabled:opacity-50">
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

// ── Abandon modal ─────────────────────────────────────────────────────────
function AbandonModal({ book, open, onClose }: { book: Book; open: boolean; onClose: () => void }) {
  const { updateBook } = useBookMutations()
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

  const handleAbandon = async () => {
    setSaving(true)
    await updateBook.mutateAsync({ id: book.id, updates: {
      status: 'abandoned', abandon_reason: reason.trim() || null
    }})
    setSaving(false)
    onClose()
  }

  return (
    <Dialog.Root open={open} onOpenChange={v => { if (!v) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-bg/85 backdrop-blur-sm" />
        <Dialog.Content className="fixed bottom-0 left-0 right-0 z-50 bg-surface border-t border-border rounded-t-2xl p-5 shadow-2xl sm:inset-auto sm:left-1/2 sm:-translate-x-1/2 sm:top-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-md sm:rounded-2xl sm:border"
          style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}>
          <div className="w-10 h-1 rounded-full bg-border mx-auto mb-4 sm:hidden" />
          <div className="flex items-center justify-between mb-2">
            <Dialog.Title className="text-base font-medium text-text">Put it down?</Dialog.Title>
            <button onClick={onClose} className="text-text-muted hover:text-text"><X size={18} /></button>
          </div>
          <p className="text-sm text-text-secondary mb-4">That's okay. Why are you stopping? <span className="text-text-muted">(Optional)</span></p>
          <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3}
            placeholder="Not the right time, too dense, lost interest…"
            className="selectable w-full bg-surface-2 border border-border rounded-xl px-4 py-3 text-text placeholder-text-muted focus:border-warning focus:outline-none resize-none mb-4" />
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 py-3 bg-surface-2 text-text font-medium rounded-xl hover:bg-muted transition-colors">Cancel</button>
            <button onClick={handleAbandon} disabled={saving}
              className="flex-[2] py-3 bg-warning/20 text-warning font-medium rounded-xl hover:bg-warning/30 transition-colors disabled:opacity-50">
              {saving ? 'Saving…' : 'Abandon Book'}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

// ── Progress modal ────────────────────────────────────────────────────────
function ProgressModal({ book, open, onClose }: { book: Book; open: boolean; onClose: () => void }) {
  const { updateBook } = useBookMutations()
  const [page, setPage] = useState(book.current_page?.toString() || '0')
  const [extraPages, setExtraPages] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    const updates: Record<string, unknown> = { current_page: parseInt(page) || 0 }
    if (!book.total_pages && extraPages) updates.total_pages = parseInt(extraPages)
    await updateBook.mutateAsync({ id: book.id, updates })
    setSaving(false)
    onClose()
  }

  const total = book.total_pages || (extraPages ? parseInt(extraPages) : null)
  const pct = total ? Math.min(Math.round(((parseInt(page) || 0) / total) * 100), 100) : 0

  return (
    <Dialog.Root open={open} onOpenChange={v => { if (!v) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-bg/85 backdrop-blur-sm" />
        <Dialog.Content className="fixed bottom-0 left-0 right-0 z-50 bg-surface border-t border-border rounded-t-2xl p-5 shadow-2xl sm:inset-auto sm:left-1/2 sm:-translate-x-1/2 sm:top-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-md sm:rounded-2xl sm:border"
          style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}>
          <div className="w-10 h-1 rounded-full bg-border mx-auto mb-4 sm:hidden" />
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-base font-medium text-text">Update Progress</Dialog.Title>
            <button onClick={onClose} className="text-text-muted hover:text-text"><X size={18} /></button>
          </div>
          <div className="space-y-4">
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <label className="block text-xs text-text-muted mb-1.5 uppercase tracking-wider">Current Page</label>
                <input autoFocus type="number" min="0" max={book.total_pages || undefined}
                  value={page} onChange={e => setPage(e.target.value)}
                  className="selectable w-full bg-surface-2 border border-border rounded-xl px-4 py-3 text-text focus:border-accent focus:outline-none" />
              </div>
              {!book.total_pages && (
                <div className="flex-1">
                  <label className="block text-xs text-text-muted mb-1.5 uppercase tracking-wider">Total Pages</label>
                  <input type="number" min="1" value={extraPages} onChange={e => setExtraPages(e.target.value)}
                    placeholder="Add now"
                    className="selectable w-full bg-surface-2 border border-border rounded-xl px-4 py-3 text-text focus:border-accent focus:outline-none placeholder-text-muted" />
                </div>
              )}
              {book.total_pages && <span className="text-text-muted pb-3">/ {book.total_pages}</span>}
            </div>
            {total && (
              <div>
                <div className="flex justify-between text-xs text-text-muted mb-1">
                  <span>Progress</span><span>{pct}%</span>
                </div>
                <div className="h-2 bg-surface-2 rounded-full overflow-hidden">
                  <div className="h-full bg-info/60 rounded-full transition-all" style={{ width: `${pct}%` }} />
                </div>
              </div>
            )}
            <button onClick={handleSave} disabled={saving}
              className="w-full py-3 bg-accent text-bg font-medium rounded-xl hover:bg-accent-dim transition-colors disabled:opacity-50">
              {saving ? 'Saving…' : 'Save Progress'}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

// ── Main BookItem ─────────────────────────────────────────────────────────
export function BookItem({ book, onDelete }: { book: Book; onDelete: (id: string) => void }) {
  const { updateBook } = useBookMutations()
  const [swiped, setSwiped] = useState(false)
  const [showReflection, setShowReflection] = useState(false)
  const [showFinish, setShowFinish] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [showAbandon, setShowAbandon] = useState(false)
  const [showProgress, setShowProgress] = useState(false)
  const touchStartX = useRef<number | null>(null)

  const handleTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX }
  const handleTouchMove  = (e: React.TouchEvent) => {
    if (!touchStartX.current) return
    const diff = touchStartX.current - e.touches[0].clientX
    if (diff > 50)  setSwiped(true)
    if (diff < -50) setSwiped(false)
  }
  const handleTouchEnd = () => { touchStartX.current = null }

  const pct = book.total_pages && book.current_page
    ? Math.min(Math.round((book.current_page / book.total_pages) * 100), 100) : 0

  const statusColor = {
    'reading': 'text-info bg-info/10',
    'finished': 'text-success bg-success/10',
    'abandoned': 'text-warning bg-warning/10',
    'to-read': 'text-text-muted bg-surface-2',
  }[book.status] ?? 'text-text-muted bg-surface-2'

  const statusLabel = {
    'to-read': 'To read', 'reading': 'Reading',
    'finished': 'Finished', 'abandoned': 'Abandoned',
  }[book.status] ?? book.status

  const handleStartReading = () => {
    updateBook.mutate({ id: book.id, updates: {
      status: 'reading',
      started_at: new Date().toISOString().split('T')[0],
    }})
  }

  return (
    <>
      <div className="relative overflow-hidden rounded-xl bg-surface border border-border">
        {/* Swipe delete */}
        <div className="absolute inset-y-0 right-0 flex items-center justify-end bg-danger/20 px-4 w-full">
          <button onClick={() => onDelete(book.id)} className="p-2 text-danger rounded-full transition-colors">
            <Trash2 size={18} />
          </button>
        </div>

        <div
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className={clsx('relative flex items-start gap-4 p-4 bg-surface transition-transform duration-200 ease-out', swiped ? '-translate-x-16' : 'translate-x-0')}
        >
          {/* Book cover placeholder */}
          <div className="w-11 h-16 bg-surface-2 border border-border rounded flex-shrink-0 flex items-center justify-center">
            <span className="text-xl opacity-25">📘</span>
          </div>

          <div className="flex flex-col min-w-0 flex-1 gap-1">
            {/* Title + status */}
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium text-text leading-snug">{book.title}</p>
                {book.author && <p className="text-xs text-text-secondary mt-0.5">{book.author}</p>}
              </div>
              <span className={clsx('text-[10px] font-medium uppercase tracking-wider flex-shrink-0 mt-0.5 px-2 py-0.5 rounded-full', statusColor)}>
                {statusLabel}
              </span>
            </div>

            {/* Reading progress */}
            {book.status === 'reading' && (
              <button onClick={() => setShowProgress(true)} className="text-left group/prog mt-1">
                <div className="flex justify-between text-[10px] text-text-muted mb-1">
                  <span className="group-hover/prog:text-accent transition-colors">
                    {book.total_pages ? 'Update progress' : 'Tap to add page count'}
                  </span>
                  <span>{book.current_page || 0}{book.total_pages ? ` / ${book.total_pages}` : ' pages'}</span>
                </div>
                <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden border border-dashed border-border/50">
                  {book.total_pages
                    ? <div className="h-full bg-info/60 group-hover/prog:bg-accent/60 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    : null}
                </div>
              </button>
            )}

            {/* Finished reflection snippet */}
            {book.status === 'finished' && book.reflection && (
              <p className="text-xs text-text-muted mt-1 italic line-clamp-2 leading-relaxed">
                {book.reflection.split('\n').find(l => l && !l.startsWith('**')) || ''}
              </p>
            )}

            {/* Abandon reason */}
            {book.status === 'abandoned' && book.abandon_reason && (
              <p className="text-xs text-text-muted mt-1 italic">"{book.abandon_reason}"</p>
            )}

            {/* Actions row */}
            <div className="flex items-center gap-1 mt-2">
              <button onClick={() => setShowEdit(true)} title="Edit"
                className="p-1.5 text-text-muted hover:text-accent hover:bg-accent/10 rounded-lg transition-colors">
                <Pencil size={14} />
              </button>

              {book.status === 'to-read' && (
                <button onClick={handleStartReading} title="Start reading"
                  className="p-1.5 text-text-muted hover:text-info hover:bg-info/10 rounded-lg transition-colors">
                  <BookOpen size={14} />
                </button>
              )}

              {book.status === 'reading' && (
                <>
                  <button onClick={() => setShowFinish(true)} title="Mark finished"
                    className="p-1.5 text-text-muted hover:text-success hover:bg-success/10 rounded-lg transition-colors">
                    <CheckCheck size={14} />
                  </button>
                  <button onClick={() => setShowAbandon(true)} title="Abandon"
                    className="p-1.5 text-text-muted hover:text-warning hover:bg-warning/10 rounded-lg transition-colors">
                    <BookX size={14} />
                  </button>
                </>
              )}

              {book.status === 'finished' && book.reflection && (
                <button onClick={() => setShowReflection(v => !v)} title={showReflection ? 'Hide reflection' : 'Show reflection'}
                  className="p-1.5 text-text-muted hover:text-text hover:bg-surface-2 rounded-lg transition-colors">
                  {showReflection ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
              )}

              <button onClick={() => onDelete(book.id)} title="Delete"
                className="p-1.5 text-text-muted hover:text-danger hover:bg-danger/10 rounded-lg transition-colors ml-auto">
                <Trash2 size={14} />
              </button>
            </div>

            {/* Expandable reflection */}
            {showReflection && book.reflection && (
              <div className="mt-3 pt-3 border-t border-border space-y-3">
                {book.reflection.split('\n\n').map((section, i) => (
                  <div key={i}>
                    {section.split('\n').map((line, j) => (
                      <p key={j} className={clsx('text-xs leading-relaxed',
                        line.startsWith('**') ? 'font-medium text-text-secondary mb-1' : 'text-text-muted'
                      )}>
                        {line.replace(/\*\*/g, '')}
                      </p>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <FinishBookFlow book={book} open={showFinish} onClose={() => setShowFinish(false)} />
      <EditBookModal   book={book} open={showEdit}   onClose={() => setShowEdit(false)} />
      <AbandonModal    book={book} open={showAbandon} onClose={() => setShowAbandon(false)} />
      <ProgressModal   book={book} open={showProgress} onClose={() => setShowProgress(false)} />
    </>
  )
}
