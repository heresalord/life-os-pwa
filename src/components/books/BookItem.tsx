import { useState, useRef, useEffect } from 'react'
import {
  Trash2, Pencil, CheckCheck, BookX, ChevronDown, ChevronUp,
  X, BookOpen, Star, Quote, MoreHorizontal,
} from 'lucide-react'
import * as Dialog from '@radix-ui/react-dialog'
import { useBookMutations } from '../../hooks/useBookMutations'
import { useQuotesQuery } from '../../hooks/useQuotesQuery'
import { useQuoteMutations } from '../../hooks/useQuoteMutations'
import { haptic } from '../../lib/haptic'
import type { Book } from '../../db/schema'
import { useNavigate } from 'react-router-dom'
import clsx from 'clsx'

// ── Star rating widget ────────────────────────────────────────────────────
function StarRating({
  value, onChange, size = 18, readOnly = false,
}: { value: number | null; onChange?: (v: number) => void; size?: number; readOnly?: boolean }) {
  const [hovered, setHovered] = useState<number | null>(null)
  const display = hovered ?? value ?? 0
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          disabled={readOnly}
          onClick={() => !readOnly && onChange?.(n)}
          onMouseEnter={() => !readOnly && setHovered(n)}
          onMouseLeave={() => !readOnly && setHovered(null)}
          className={clsx('transition-colors', readOnly ? 'cursor-default' : 'cursor-pointer')}
          style={{ lineHeight: 1 }}
        >
          <Star
            size={size}
            className={n <= display ? 'text-warning fill-warning' : 'text-border'}
            strokeWidth={1.5}
          />
        </button>
      ))}
    </div>
  )
}

// ── Finish flow ───────────────────────────────────────────────────────────
function FinishBookFlow({ book, open, onClose }: { book: Book; open: boolean; onClose: () => void }) {
  const { updateBook } = useBookMutations()
  const [step, setStep] = useState(1)
  const [q1, setQ1] = useState('')
  const [q2, setQ2] = useState('')
  const [q3, setQ3] = useState('')
  const [rating, setRating] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)

  const STEPS = 4
  const minLen = 10
  const canNext =
    step === 1 ? q1.trim().length >= minLen
    : step === 2 ? q2.trim().length >= minLen
    : step === 3 ? q3.trim().length >= minLen
    : true // rating is optional

  const handleFinish = async () => {
    setSaving(true)
    const reflection = `**What I learned:**\n${q1.trim()}\n\n**What I'll remember:**\n${q2.trim()}\n\n**Would I recommend it?**\n${q3.trim()}`
    await updateBook.mutateAsync({ id: book.id, updates: {
      status: 'finished', reflection,
      finished_at: new Date().toISOString().split('T')[0],
      rating,
    }})
    haptic('success')
    setSaving(false)
    onClose()
  }

  return (
    <Dialog.Root open={open} onOpenChange={v => { if (!v) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-bg/85 backdrop-blur-sm" />
        <Dialog.Content
          className="fixed bottom-0 left-0 right-0 z-50 bg-surface border-t border-border rounded-t-2xl p-6 shadow-2xl sm:inset-auto sm:left-1/2 sm:-translate-x-1/2 sm:top-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-lg sm:rounded-2xl sm:border"
          style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
        >
          <div className="w-10 h-1 rounded-full bg-border mx-auto mb-5 sm:hidden" />
          <div className="flex items-center justify-between mb-3">
            <Dialog.Title className="text-base font-display text-text">Finishing "{book.title}"</Dialog.Title>
            <button onClick={onClose} className="text-text-muted hover:text-text"><X size={18} /></button>
          </div>
          <div className="flex gap-2 mb-6">
            {Array.from({ length: STEPS }, (_, i) => (
              <div key={i} className={`flex-1 h-1 rounded-full transition-all duration-300 ${i + 1 <= step ? 'bg-success' : 'bg-surface-2'}`} />
            ))}
          </div>
          <p className="text-[11px] text-text-muted uppercase tracking-wider mb-2">Step {step} of {STEPS}</p>

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
          {step === 4 && (
            <div className="space-y-5 py-2">
              <div>
                <p className="text-lg font-display text-text mb-1">Rate this book</p>
                <p className="text-sm text-text-secondary mb-5">Optional — how would you rate it overall?</p>
                <div className="flex justify-center">
                  <StarRating value={rating} onChange={setRating} size={36} />
                </div>
                {rating && (
                  <p className="text-center text-sm text-text-muted mt-3">
                    {['', 'Did not enjoy it', 'It was okay', 'Liked it', 'Really liked it', 'Loved it'][rating]}
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="flex gap-3 mt-5">
            {step > 1 && (
              <button onClick={() => setStep(s => s - 1)}
                className="flex-1 py-3 bg-surface-2 text-text font-medium rounded-xl hover:bg-muted transition-colors">Back</button>
            )}
            {step < STEPS ? (
              <button onClick={() => setStep(s => s + 1)} disabled={!canNext}
                className="flex-[2] py-3 bg-success/20 text-success font-medium rounded-xl hover:bg-success/30 transition-colors disabled:opacity-40">Next</button>
            ) : (
              <button onClick={handleFinish} disabled={saving}
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

// ── Quotes panel ──────────────────────────────────────────────────────────
function QuotesPanel({ book, open, onClose }: { book: Book; open: boolean; onClose: () => void }) {
  const { data: quotes = [], isLoading } = useQuotesQuery(open ? book.id : null)
  const { addQuote, deleteQuote } = useQuoteMutations(book.id)
  const [text, setText] = useState('')
  const [page, setPage] = useState('')

  const handleAdd = () => {
    const t = text.trim()
    if (!t) return
    haptic('light')
    addQuote.mutate({ text: t, page: page ? parseInt(page) : null }, {
      onSuccess: () => { setText(''); setPage('') },
    })
  }

  return (
    <Dialog.Root open={open} onOpenChange={v => { if (!v) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-bg/80 backdrop-blur-sm" />
        <Dialog.Content
          className="fixed bottom-0 left-0 right-0 z-50 bg-surface border-t border-border rounded-t-2xl shadow-2xl flex flex-col sm:inset-auto sm:left-1/2 sm:-translate-x-1/2 sm:top-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-lg sm:rounded-2xl sm:border sm:max-h-[80vh]"
          style={{ maxHeight: '80dvh', paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
        >
          <div className="p-5 pb-0 flex-shrink-0">
            <div className="w-10 h-1 rounded-full bg-border mx-auto mb-4 sm:hidden" />
            <div className="flex items-center justify-between mb-4">
              <Dialog.Title className="text-base font-medium text-text">
                Quotes · <span className="text-text-muted font-normal text-sm">{book.title}</span>
              </Dialog.Title>
              <button onClick={onClose} className="text-text-muted hover:text-text"><X size={18} /></button>
            </div>
            {/* Add quote */}
            <div className="space-y-2 mb-4">
              <textarea
                value={text}
                onChange={e => setText(e.target.value)}
                rows={2}
                placeholder="Paste or type a quote…"
                className="selectable w-full bg-surface-2 border border-border rounded-xl px-4 py-3 text-sm text-text placeholder-text-muted focus:border-accent focus:outline-none resize-none"
              />
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  value={page}
                  onChange={e => setPage(e.target.value)}
                  placeholder="Page (optional)"
                  className="selectable w-36 bg-surface-2 border border-border rounded-xl px-3 py-2 text-sm text-text placeholder-text-muted focus:border-accent focus:outline-none"
                />
                <button
                  onClick={handleAdd}
                  disabled={!text.trim() || addQuote.isPending}
                  className="flex-1 py-2 bg-accent text-bg font-medium text-sm rounded-xl hover:bg-accent-dim transition-colors disabled:opacity-40"
                >
                  {addQuote.isPending ? 'Saving…' : 'Save Quote'}
                </button>
              </div>
            </div>
          </div>

          {/* Quote list */}
          <div className="overflow-y-auto flex-1 px-5 pb-2 space-y-3">
            {isLoading && (
              <div className="flex justify-center py-6">
                <div className="w-5 h-5 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
              </div>
            )}
            {!isLoading && quotes.length === 0 && (
              <p className="text-center text-sm text-text-muted py-6 italic">
                No quotes saved yet. Highlight something worth keeping.
              </p>
            )}
            {quotes.map(q => (
              <div key={q.id} className="group/quote relative bg-surface-2 border border-border rounded-xl p-4">
                <p className="text-sm text-text leading-relaxed italic">"{q.text}"</p>
                {q.page && (
                  <p className="text-xs text-text-muted mt-2">— p. {q.page}</p>
                )}
                <button
                  onClick={() => { haptic('light'); deleteQuote.mutate(q.id) }}
                  className="absolute top-3 right-3 p-1 text-text-muted opacity-0 group-hover/quote:opacity-100 focus:opacity-100 hover:text-danger transition-all"
                  title="Delete quote"
                >
                  <X size={13} />
                </button>
              </div>
            ))}
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
  const [rating, setRating] = useState<number | null>(book.rating ?? null)
  const [genre, setGenre] = useState(book.genre || '')
  const [isbn, setIsbn] = useState(book.isbn || '')
  const [language, setLanguage] = useState(book.language || '')
  const [source, setSource] = useState<'physical' | 'ebook' | 'audiobook' | 'library' | ''>(book.source || '')
  const [shelves, setShelves] = useState(Array.isArray(book.shelves) ? book.shelves.join(', ') : '')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    await updateBook.mutateAsync({ id: book.id, updates: {
      title: title.trim(),
      author: author.trim() || null,
      total_pages: pages ? parseInt(pages) : null,
      status,
      rating,
      genre: genre.trim() || null,
      isbn: isbn.trim() || null,
      language: language.trim() || null,
      source: source || null,
      shelves: shelves ? shelves.split(',').map(s => s.trim()).filter(Boolean) : [],
      started_at: status === 'reading' && !book.started_at ? new Date().toISOString().split('T')[0] : book.started_at,
    }})
    setSaving(false)
    onClose()
  }

  return (
    <Dialog.Root open={open} onOpenChange={v => { if (!v) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-bg/85 backdrop-blur-sm" />
        <Dialog.Content className="fixed bottom-0 left-0 right-0 z-50 bg-surface border-t border-border rounded-t-2xl p-5 shadow-2xl sm:inset-auto sm:left-1/2 sm:-translate-x-1/2 sm:top-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-md sm:rounded-2xl sm:border max-h-[90vh] overflow-y-auto"
          style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}>
          <div className="w-10 h-1 rounded-full bg-border mx-auto mb-4 sm:hidden" />
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-base font-medium text-text">Edit Book</Dialog.Title>
            <button onClick={onClose} className="text-text-muted hover:text-text"><X size={18} /></button>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-text-muted mb-2 uppercase tracking-wider">Title</label>
              <input value={title} onChange={e => setTitle(e.target.value)}
                className="selectable w-full bg-surface-2 border border-border rounded-xl px-4 py-3 text-text focus:border-accent focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-2 uppercase tracking-wider">Author</label>
              <input value={author} onChange={e => setAuthor(e.target.value)} placeholder="Optional"
                className="selectable w-full bg-surface-2 border border-border rounded-xl px-4 py-3 text-text focus:border-accent focus:outline-none" />
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-xs text-text-muted mb-2 uppercase tracking-wider">Total Pages</label>
                <input type="number" min="1" value={pages} onChange={e => setPages(e.target.value)} placeholder="Optional"
                  className="selectable w-full bg-surface-2 border border-border rounded-xl px-4 py-3 text-text focus:border-accent focus:outline-none" />
              </div>
              <div className="flex-[2]">
                <label className="block text-xs text-text-muted mb-2 uppercase tracking-wider">Status</label>
                <select value={status} onChange={e => setStatus(e.target.value as Book['status'])}
                  className="w-full bg-surface-2 border border-border rounded-xl px-4 py-3 text-text focus:border-accent focus:outline-none appearance-none">
                  <option value="to-read">To Read</option>
                  <option value="reading">Reading</option>
                  <option value="finished">Finished</option>
                  <option value="abandoned">Abandoned</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-xs text-text-muted mb-2 uppercase tracking-wider">Genre</label>
                <input value={genre} onChange={e => setGenre(e.target.value)} placeholder="e.g. Non-fiction"
                  className="selectable w-full bg-surface-2 border border-border rounded-xl px-4 py-3 text-text focus:border-accent focus:outline-none" />
              </div>
              <div className="flex-1">
                <label className="block text-xs text-text-muted mb-2 uppercase tracking-wider">Source</label>
                <select value={source} onChange={e => setSource(e.target.value as any)}
                  className="w-full bg-surface-2 border border-border rounded-xl px-4 py-3 text-text focus:border-accent focus:outline-none appearance-none">
                  <option value="">Select source</option>
                  <option value="physical">Physical</option>
                  <option value="ebook">E-Book</option>
                  <option value="audiobook">Audiobook</option>
                  <option value="library">Library</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-xs text-text-muted mb-2 uppercase tracking-wider">ISBN</label>
                <input value={isbn} onChange={e => setIsbn(e.target.value)} placeholder="Optional"
                  className="selectable w-full bg-surface-2 border border-border rounded-xl px-4 py-3 text-text focus:border-accent focus:outline-none" />
              </div>
              <div className="flex-1">
                <label className="block text-xs text-text-muted mb-2 uppercase tracking-wider">Language</label>
                <input value={language} onChange={e => setLanguage(e.target.value)} placeholder="e.g. English"
                  className="selectable w-full bg-surface-2 border border-border rounded-xl px-4 py-3 text-text focus:border-accent focus:outline-none" />
              </div>
            </div>

            <div>
              <label className="block text-xs text-text-muted mb-2 uppercase tracking-wider">Shelves / Collections</label>
              <input value={shelves} onChange={e => setShelves(e.target.value)} placeholder="e.g. Sci-Fi, Classics, Favorites"
                className="selectable w-full bg-surface-2 border border-border rounded-xl px-4 py-3 text-text focus:border-accent focus:outline-none" />
              <p className="text-[10px] text-text-muted mt-1">Separate shelf names with commas</p>
            </div>

            <div>
              <label className="block text-xs text-text-muted mb-2 uppercase tracking-wider">Rating</label>
              <StarRating value={rating} onChange={setRating} size={22} />
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
    await updateBook.mutateAsync({ id: book.id, updates: { status: 'abandoned', abandon_reason: reason.trim() || null }})
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
                <label className="block text-xs text-text-muted mb-2 uppercase tracking-wider">Current Page</label>
                <input autoFocus type="number" min="0" max={book.total_pages || undefined}
                  value={page} onChange={e => setPage(e.target.value)}
                  className="selectable w-full bg-surface-2 border border-border rounded-xl px-4 py-3 text-text focus:border-accent focus:outline-none" />
              </div>
              {!book.total_pages && (
                <div className="flex-1">
                  <label className="block text-xs text-text-muted mb-2 uppercase tracking-wider">Total Pages</label>
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
// Apple Books keeps its library grid uncluttered by tucking every secondary
// action behind a single "···" — this replaces the row of 3-5 always-visible
// icon buttons the grid card used to show.
function BookActionsMenu({
  items,
  size = 14,
}: {
  items: { label: string; icon: React.ComponentType<{ size?: number }>; onClick: () => void; tone?: 'default' | 'danger' }[]
  size?: number
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); haptic('light'); setOpen(v => !v) }}
        title="More"
        className="w-7 h-7 flex items-center justify-center rounded-full text-text-muted hover:text-text hover:bg-surface-2 transition-colors"
      >
        <MoreHorizontal size={size} />
      </button>
      {open && (
        <div
          className="absolute right-0 top-full mt-1 z-20 w-44 bg-surface border border-border rounded-xl shadow-lg py-1 animate-in fade-in slide-in-from-top-1 duration-150"
          onClick={(e) => e.stopPropagation()}
        >
          {items.map(({ label, icon: Icon, onClick, tone }) => (
            <button
              key={label}
              onClick={() => { setOpen(false); onClick() }}
              className={clsx(
                'w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-left transition-colors',
                tone === 'danger' ? 'text-danger hover:bg-danger/10' : 'text-text hover:bg-surface-2'
              )}
            >
              <Icon size={13} />
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function BookItem({
  book,
  onDelete,
  layoutMode = 'grid',
}: {
  book: Book
  onDelete: (id: string) => void
  layoutMode?: 'grid' | 'hero'
}) {
  const navigate = useNavigate()
  const { updateBook } = useBookMutations()
  const [showReflection, setShowReflection] = useState(false)
  const [showFinish, setShowFinish] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [showAbandon, setShowAbandon] = useState(false)
  const [showProgress, setShowProgress] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showQuotes, setShowQuotes] = useState(false)

  const pct = book.total_pages && book.current_page
    ? Math.min(Math.round((book.current_page / book.total_pages) * 100), 100) : 0

  const handleStartReading = () => {
    updateBook.mutate({ id: book.id, updates: {
      status: 'reading', started_at: new Date().toISOString().split('T')[0],
    }})
  }

  const confirmDelete = () => {
    haptic('medium')
    setShowDeleteConfirm(true)
  }

  if (layoutMode === 'hero') {
    return (
      <>
        <div className="flex flex-col sm:flex-row gap-5 sm:gap-6 w-full mb-8">
          {/* Cover — same floating-shadow treatment as the grid, just larger */}
          <div
            onClick={() => navigate(`/books/${book.id}`)}
            className="relative w-32 sm:w-40 aspect-[2/3] flex-shrink-0 rounded-lg overflow-hidden shadow-lg ring-1 ring-black/5 cursor-pointer bg-surface-2 flex items-center justify-center mx-auto sm:mx-0"
          >
            {book.cover_url ? (
              <img src={book.cover_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-5xl opacity-20">📘</span>
            )}
          </div>

          {/* Details */}
          <div className="flex-1 flex flex-col justify-center gap-3 text-center sm:text-left">
            <div>
              <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-1">Reading Now</p>
              <button
                onClick={() => navigate(`/books/${book.id}`)}
                className="text-xl font-display font-bold text-text leading-snug hover:text-accent transition-colors text-left block w-full"
              >
                {book.title}
              </button>
              {book.author && (
                <button
                  onClick={e => { e.stopPropagation(); navigate(`/books/author/${encodeURIComponent(book.author!)}`) }}
                  className="text-sm text-text-secondary hover:text-accent transition-colors mt-0.5"
                >
                  {book.author}
                </button>
              )}
            </div>

            {/* Progress — same thin unlabeled track as the grid cards, just wider */}
            <button onClick={() => setShowProgress(true)} className="group/prog space-y-1.5">
              <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden max-w-xs mx-auto sm:mx-0">
                <div className="h-full bg-accent rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
              </div>
              <p className="text-xs text-text-muted group-hover/prog:text-accent transition-colors">
                {book.total_pages
                  ? <>Page {book.current_page || 0} of {book.total_pages} · {pct}%</>
                  : 'Tap to set progress'
                }
              </p>
            </button>

            {/* Primary actions understated, secondary tucked into the same
                overflow menu the grid cards use — Apple Books never shows
                more than one or two calls to action on a reading card. */}
            <div className="flex items-center justify-center sm:justify-start gap-4 pt-1">
              <button
                onClick={() => setShowFinish(true)}
                className="text-sm font-semibold text-success hover:underline"
              >
                Mark Finished
              </button>
              <button
                onClick={() => setShowAbandon(true)}
                className="text-sm font-medium text-text-muted hover:text-warning transition-colors"
              >
                Stop Reading
              </button>
              <div className="ml-auto sm:ml-0">
                <BookActionsMenu
                  items={[
                    { label: 'Edit', icon: Pencil, onClick: () => setShowEdit(true) },
                    { label: 'Quotes', icon: Quote, onClick: () => setShowQuotes(true) },
                    { label: 'Delete', icon: Trash2, onClick: confirmDelete, tone: 'danger' as const },
                  ]}
                />
              </div>
            </div>
          </div>
        </div>

        <FinishBookFlow book={book} open={showFinish}   onClose={() => setShowFinish(false)} />
        <EditBookModal  book={book} open={showEdit}     onClose={() => setShowEdit(false)} />
        <AbandonModal   book={book} open={showAbandon}  onClose={() => setShowAbandon(false)} />
        <ProgressModal  book={book} open={showProgress} onClose={() => setShowProgress(false)} />
        <QuotesPanel    book={book} open={showQuotes}   onClose={() => setShowQuotes(false)} />

        {/* ── Delete confirmation ── */}
        <Dialog.Root open={showDeleteConfirm} onOpenChange={v => { if (!v) setShowDeleteConfirm(false) }}>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-50 bg-bg/80 backdrop-blur-sm" />
            <Dialog.Content
              className="fixed bottom-0 left-0 right-0 z-50 bg-surface border-t border-border rounded-t-2xl p-5 shadow-2xl sm:inset-auto sm:left-1/2 sm:-translate-x-1/2 sm:top-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-sm sm:rounded-2xl sm:border"
              style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
            >
              <div className="w-10 h-1 rounded-full bg-border mx-auto mb-5 sm:hidden" />
              <div className="flex items-start gap-4 mb-5">
                {book.cover_url && (
                  <img src={book.cover_url} alt="" className="w-10 h-14 object-cover rounded flex-shrink-0 opacity-70" />
                )}
                <div>
                  <Dialog.Title className="text-base font-medium text-text mb-0.5">Remove this book?</Dialog.Title>
                  <p className="text-sm text-text-secondary">
                    <span className="font-medium text-text">{book.title}</span> will be permanently deleted.
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 py-3 bg-surface-2 text-text font-medium rounded-xl hover:bg-muted transition-colors">
                  Cancel
                </button>
                <button onClick={() => { setShowDeleteConfirm(false); onDelete(book.id) }}
                  className="flex-[2] py-3 bg-danger/15 text-danger font-medium rounded-xl hover:bg-danger/25 transition-colors">
                  Delete
                </button>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </>
    )
  }

  return (
    <>
      <div className="group flex flex-col h-full">
        {/* Cover — floats on its own shadow, no card chrome around it. Status
            is intentionally not shown here: every card in a given tab already
            shares one status (Reading / To Read / Finished / Abandoned), so
            repeating it per-card was pure noise. */}
        <div
          onClick={() => navigate(`/books/${book.id}`)}
          className="relative aspect-[2/3] rounded-lg overflow-hidden shadow-md ring-1 ring-black/5 cursor-pointer bg-surface-2 flex items-center justify-center"
        >
          {book.cover_url ? (
            <img src={book.cover_url} alt="" className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300" />
          ) : (
            <span className="text-4xl opacity-20">📘</span>
          )}
        </div>

        {/* Title / author — sits below the cover on the page background,
            no bordered card wrapping it, matching Apple Books' library grid. */}
        <div className="pt-2.5 flex items-start justify-between gap-1">
          <div className="min-w-0 flex-1">
            <button
              onClick={() => navigate(`/books/${book.id}`)}
              className="text-[13px] font-semibold text-text leading-snug hover:text-accent transition-colors text-left block line-clamp-2 w-full"
            >
              {book.title}
            </button>
            {book.author && (
              <button
                onClick={e => { e.stopPropagation(); navigate(`/books/author/${encodeURIComponent(book.author!)}`) }}
                className="text-[11px] text-text-muted truncate hover:text-accent transition-colors text-left block mt-0.5 w-full"
              >
                {book.author}
              </button>
            )}
          </div>
          <BookActionsMenu
            items={[
              { label: 'Edit', icon: Pencil, onClick: () => setShowEdit(true) },
              { label: 'Quotes', icon: Quote, onClick: () => setShowQuotes(true) },
              ...(book.status === 'to-read' ? [{ label: 'Start reading', icon: BookOpen, onClick: handleStartReading }] : []),
              ...(book.status === 'reading' ? [
                { label: 'Mark finished', icon: CheckCheck, onClick: () => setShowFinish(true) },
                { label: 'Abandon', icon: BookX, onClick: () => setShowAbandon(true) },
              ] : []),
              ...(book.status === 'finished' && book.reflection ? [{ label: showReflection ? 'Hide reflection' : 'Show reflection', icon: showReflection ? ChevronUp : ChevronDown, onClick: () => setShowReflection(v => !v) }] : []),
              { label: 'Delete', icon: Trash2, onClick: confirmDelete, tone: 'danger' as const },
            ]}
          />
        </div>

        {/* Star rating (finished books) */}
        {book.status === 'finished' && book.rating && (
          <div className="pt-1">
            <StarRating value={book.rating} size={11} readOnly />
          </div>
        )}

        {/* Reading progress — a thin, unlabeled track under the cover, the
            way Apple Books shows progress on "Reading Now" items. Tap to
            update; the percentage is the only text shown. */}
        {book.status === 'reading' && (
          <button onClick={() => setShowProgress(true)} className="mt-2 group/prog">
            <div className="h-1 bg-surface-2 rounded-full overflow-hidden">
              <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-[10px] text-text-muted mt-1 block group-hover/prog:text-accent transition-colors">{pct}%</span>
          </button>
        )}

        {/* Shelves list */}
        {book.shelves && Array.isArray(book.shelves) && book.shelves.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {(book.shelves as any[]).map((shelf: string) => (
              <span key={shelf} className="text-[9px] bg-surface-2 border border-border/80 text-text-muted px-2 py-0.5 rounded-md font-medium">
                {shelf}
              </span>
            ))}
          </div>
        )}

        {/* Finished: reflection snippet */}
        {book.status === 'finished' && book.reflection && (
          <p className="text-[11px] text-text-muted italic line-clamp-2 leading-relaxed mt-1.5">
            {book.reflection.split('\n').find(l => l && !l.startsWith('**')) || ''}
          </p>
        )}

        {/* Abandoned: reason */}
        {book.status === 'abandoned' && book.abandon_reason && (
          <p className="text-[11px] text-text-muted italic mt-1.5">"{book.abandon_reason}"</p>
        )}

        {/* Expandable reflection */}
        {showReflection && book.reflection && (
          <div className="mt-2 pt-2 border-t border-border/60 space-y-2">
            {book.reflection.split('\n\n').map((section, i) => (
              <div key={i}>
                {section.split('\n').map((line, j) => (
                  <p key={j} className={clsx('text-[11px] leading-relaxed',
                    line.startsWith('**') ? 'font-medium text-text-secondary mb-0.5' : 'text-text-muted'
                  )}>
                    {line.replace(/\*\*/g, '')}
                  </p>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      <FinishBookFlow book={book} open={showFinish}   onClose={() => setShowFinish(false)} />
      <EditBookModal  book={book} open={showEdit}     onClose={() => setShowEdit(false)} />
      <AbandonModal   book={book} open={showAbandon}  onClose={() => setShowAbandon(false)} />
      <ProgressModal  book={book} open={showProgress} onClose={() => setShowProgress(false)} />
      <QuotesPanel    book={book} open={showQuotes}   onClose={() => setShowQuotes(false)} />

      {/* ── Delete confirmation ── */}
      <Dialog.Root open={showDeleteConfirm} onOpenChange={v => { if (!v) setShowDeleteConfirm(false) }}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-bg/80 backdrop-blur-sm" />
          <Dialog.Content
            className="fixed bottom-0 left-0 right-0 z-50 bg-surface border-t border-border rounded-t-2xl p-5 shadow-2xl sm:inset-auto sm:left-1/2 sm:-translate-x-1/2 sm:top-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-sm sm:rounded-2xl sm:border"
            style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
          >
            <div className="w-10 h-1 rounded-full bg-border mx-auto mb-5 sm:hidden" />
            <div className="flex items-start gap-4 mb-5">
              {book.cover_url && (
                <img src={book.cover_url} alt="" className="w-10 h-14 object-cover rounded flex-shrink-0 opacity-70" />
              )}
              <div>
                <Dialog.Title className="text-base font-medium text-text mb-0.5">Remove this book?</Dialog.Title>
                <p className="text-sm text-text-secondary">
                  <span className="font-medium text-text">{book.title}</span> will be permanently deleted.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-3 bg-surface-2 text-text font-medium rounded-xl hover:bg-muted transition-colors">
                Cancel
              </button>
              <button onClick={() => { setShowDeleteConfirm(false); onDelete(book.id) }}
                className="flex-[2] py-3 bg-danger/15 text-danger font-medium rounded-xl hover:bg-danger/25 transition-colors">
                Delete
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  )
}
