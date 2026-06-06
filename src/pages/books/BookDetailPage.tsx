import React, { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import * as Dialog from '@radix-ui/react-dialog'
import { ChevronLeft, Quote as QuoteIcon, X, Award, BookOpen } from 'lucide-react'
import { useBookQuery } from '../../hooks/useBooksQuery'
import { useBookMutations } from '../../hooks/useBookMutations'
import { useQuotesQuery } from '../../hooks/useQuotesQuery'
import { useQuoteMutations } from '../../hooks/useQuoteMutations'
import { Star } from 'lucide-react'
import { haptic } from '../../lib/haptic'
import clsx from 'clsx'

const SOURCE_LABELS: Record<'physical' | 'ebook' | 'audiobook' | 'library', string> = {
  physical:  '📚 Physical',
  ebook:     '📱 E-Book',
  audiobook: '🎧 Audiobook',
  library:   '🏛️ Library',
}

function StarRating({ value, size = 16 }: { value: number | null; size?: number }) {
  if (!value) return null
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(n => (
        <Star key={n} size={size}
          className={n <= value ? 'text-warning fill-warning' : 'text-border'}
          strokeWidth={1.5}
        />
      ))}
    </div>
  )
}

export function BookDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: book, isLoading } = useBookQuery(id || '')
  const { updateBook } = useBookMutations()

  const { data: quotes = [], isLoading: isLoadingQuotes } = useQuotesQuery(id || null)
  const { addQuote, deleteQuote } = useQuoteMutations(id || '')

  const [quoteText, setQuoteText] = useState('')
  const [quotePage, setQuotePage] = useState('')

  // Simple page-based progress log
  const [currentPageInput, setCurrentPageInput] = useState('')
  const [showLogModal, setShowLogModal] = useState(false)

  if (isLoading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
      </div>
    )
  }

  if (!book) {
    return (
      <div className="space-y-4 max-w-xl mx-auto py-12 text-center">
        <p className="text-text-secondary text-sm">Book not found.</p>
        <button onClick={() => navigate('/books')}
          className="px-4 py-2 bg-surface-2 border border-border text-xs rounded-xl font-medium text-text hover:text-accent transition-colors">
          Back to Library
        </button>
      </div>
    )
  }

  const pagesLeft  = book.total_pages ? Math.max(0, book.total_pages - (book.current_page || 0)) : null
  const progressPct = book.total_pages
    ? Math.min(100, Math.round(((book.current_page || 0) / book.total_pages) * 100))
    : null

  const handleLogSession = async (e: React.FormEvent) => {
    e.preventDefault()
    const p = parseInt(currentPageInput)
    if (isNaN(p) || p < 0) return

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updates: any = { current_page: p }

    if (book.total_pages && p >= book.total_pages && book.status !== 'finished') {
      updates.status    = 'finished'
      updates.finished_at = new Date().toISOString().split('T')[0]
    }

    await updateBook.mutateAsync({ id: book.id, updates })
    setCurrentPageInput('')
    setShowLogModal(false)
    haptic('success')
  }

  const handleAddQuote = (e: React.FormEvent) => {
    e.preventDefault()
    const text = quoteText.trim()
    if (!text) return
    haptic('light')
    addQuote.mutate({ text, page: quotePage ? parseInt(quotePage) : null }, {
      onSuccess: () => { setQuoteText(''); setQuotePage('') }
    })
  }

  const statusColor = {
    'reading':   'text-info bg-info/10 border-info/20',
    'finished':  'text-success bg-success/10 border-success/20',
    'abandoned': 'text-warning bg-warning/10 border-warning/20',
    'to-read':   'text-text-muted bg-surface-2 border-border/80',
  }[book.status] ?? 'text-text-muted bg-surface-2'

  const statusLabel = {
    'to-read': 'To read', 'reading': 'Reading',
    'finished': 'Finished', 'abandoned': 'Abandoned',
  }[book.status] ?? book.status

  const sourceLabel = book.source ? (SOURCE_LABELS[book.source] ?? null) : null

  const shelves: string[] = Array.isArray(book.shelves)
    ? (book.shelves as unknown[]).filter((s): s is string => typeof s === 'string')
    : []

  return (
    <div className="space-y-6 lg:max-w-4xl">
      <button onClick={() => navigate('/books')}
        className="flex items-center gap-1 text-xs font-semibold text-text-secondary hover:text-text transition-colors">
        <ChevronLeft size={16} /> Back to Library
      </button>

      {/* ── Hero — always centered ──────────────────────────────────────── */}
      <div className="bg-surface border border-border rounded-2xl p-6 shadow-sm flex flex-col items-center text-center gap-3">
        <div className="w-28 h-40 rounded-xl overflow-hidden bg-surface-2 border border-border flex items-center justify-center flex-shrink-0 shadow-md">
          {book.cover_url
            ? <img src={book.cover_url} alt="" className="w-full h-full object-cover" />
            : <span className="text-3xl opacity-25">📘</span>
          }
        </div>

        <div className="space-y-1">
          <h1 className="text-xl md:text-2xl font-display text-text font-bold leading-snug">
            {book.title}
          </h1>
          {book.author && (
            <p className="text-sm text-text-secondary">by {book.author}</p>
          )}
        </div>

        <div className="flex flex-wrap justify-center gap-1.5 items-center">
          <span className={clsx('text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border', statusColor)}>
            {statusLabel}
          </span>
          {sourceLabel && (
            <span className="text-[10px] font-medium bg-surface-2 border border-border text-text-secondary px-2.5 py-0.5 rounded-full">
              {sourceLabel}
            </span>
          )}
          {book.genre && (
            <span className="text-[10px] font-medium bg-accent/10 border border-accent/25 text-accent px-2.5 py-0.5 rounded-full">
              🏷️ {book.genre}
            </span>
          )}
        </div>

        {book.rating && (
          <StarRating value={book.rating} size={15} />
        )}

        {shelves.length > 0 && (
          <div className="flex flex-wrap justify-center gap-1">
            {shelves.map(shelf => (
              <span key={shelf} className="text-[9px] bg-surface-2 border border-border text-text-muted px-2 py-0.5 rounded-md font-medium">
                📁 {shelf}
              </span>
            ))}
          </div>
        )}

        {book.status === 'reading' && (
          <button
            onClick={() => {
              setCurrentPageInput(String(book.current_page || ''))
              haptic('light')
              setShowLogModal(true)
            }}
            className="mt-1 px-5 py-2.5 bg-accent text-bg font-semibold text-xs rounded-xl hover:bg-accent-dim transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <BookOpen size={14} /> Update Progress
          </button>
        )}
      </div>

      {/* ── Two-column detail layout ───────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

        {/* Left / Main Column */}
        <div className="md:col-span-2 space-y-5">

          {/* Progress */}
          {book.total_pages ? (
            <div className="bg-surface border border-border p-4 rounded-2xl shadow-sm space-y-3">
              <div className="flex justify-between items-center">
                <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted">Progress</h3>
                <span className="text-xs font-bold text-text">{progressPct}%</span>
              </div>
              <div className="h-2.5 bg-surface-2 rounded-full overflow-hidden border border-border">
                <div
                  className="h-full bg-info/60 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] text-text-secondary">
                <span>Page {book.current_page || 0}</span>
                <span>{pagesLeft} pages left</span>
                <span>of {book.total_pages}</span>
              </div>
            </div>
          ) : (
            book.status === 'reading' && (
              <div className="bg-surface border border-border p-4 rounded-2xl shadow-sm">
                <p className="text-xs text-text-muted italic text-center">
                  Add total pages to track progress.
                </p>
              </div>
            )
          )}

          {/* Reflection */}
          {book.status === 'finished' && book.reflection && (
            <div className="bg-surface border border-border p-4 rounded-2xl shadow-sm space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted flex items-center gap-1.5">
                <Award size={14} className="text-success" /> Finish Reflection
              </h3>
              <div className="space-y-3.5 mt-2">
                {book.reflection.split('\n\n').map((section, i) => (
                  <div key={i} className="border-l-2 border-success/30 pl-3">
                    {section.split('\n').map((line, j) => (
                      <p key={j} className={clsx('text-xs leading-relaxed',
                        line.startsWith('**') ? 'font-semibold text-text mt-1' : 'text-text-secondary mt-0.5'
                      )}>
                        {line.replace(/\*\*/g, '')}
                      </p>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Abandon reason */}
          {book.status === 'abandoned' && book.abandon_reason && (
            <div className="bg-surface border border-border p-4 rounded-2xl shadow-sm">
              <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted mb-2">Reason for Abandoning</h3>
              <p className="text-sm text-text italic">"{book.abandon_reason}"</p>
            </div>
          )}
        </div>

        {/* Right Column */}
        <div className="space-y-5">

          {/* Details */}
          <div className="bg-surface border border-border p-4 rounded-2xl shadow-sm space-y-3.5 text-xs">
            <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted">Details</h3>
            <div className="space-y-2">
              {[
                { label: 'Language',  value: book.language || '—' },
                { label: 'ISBN',      value: book.isbn || '—' },
                { label: 'Added on',  value: book.added_at },
                { label: 'Started',   value: book.started_at },
                { label: 'Finished',  value: book.finished_at },
              ].filter(r => r.value).map(r => (
                <div key={r.label} className="flex justify-between border-b border-border/40 pb-2 last:border-0 last:pb-0">
                  <span className="text-text-secondary">{r.label}</span>
                  <span className="text-text font-semibold">{r.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Quotes */}
          <div className="bg-surface border border-border p-4 rounded-2xl shadow-sm space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted flex items-center gap-1.5">
              <QuoteIcon size={14} /> Quotes
            </h3>
            <form onSubmit={handleAddQuote} className="space-y-2">
              <textarea
                required rows={2}
                value={quoteText}
                onChange={e => setQuoteText(e.target.value)}
                placeholder="Type or paste a quote…"
                className="selectable w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-xs text-text placeholder-text-muted focus:border-accent focus:outline-none resize-none"
              />
              <div className="flex gap-2">
                <input
                  type="number" min="1"
                  value={quotePage}
                  onChange={e => setQuotePage(e.target.value)}
                  placeholder="Page #"
                  className="selectable w-20 bg-surface-2 border border-border rounded-xl px-2.5 py-1.5 text-xs text-text placeholder-text-muted focus:border-accent focus:outline-none"
                />
                <button type="submit"
                  disabled={!quoteText.trim() || addQuote.isPending}
                  className="flex-1 py-1.5 bg-accent text-bg font-semibold text-xs rounded-xl hover:bg-accent-dim transition-colors disabled:opacity-40">
                  Save Quote
                </button>
              </div>
            </form>
            <div className="space-y-2.5 pt-2 max-h-72 overflow-y-auto pr-1">
              {isLoadingQuotes && (
                <div className="flex justify-center py-4">
                  <div className="w-4 h-4 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
                </div>
              )}
              {!isLoadingQuotes && quotes.length === 0 && (
                <p className="text-xs text-text-muted italic text-center py-4">No quotes saved yet.</p>
              )}
              {quotes.map(q => (
                <div key={q.id} className="group/quote relative bg-surface-2 border border-border p-3 rounded-xl">
                  <p className="text-xs text-text leading-relaxed italic">"{q.text}"</p>
                  {q.page && <p className="text-[10px] text-text-muted mt-1.5">— p. {q.page}</p>}
                  <button
                    onClick={() => { haptic('light'); deleteQuote.mutate(q.id) }}
                    className="absolute top-2 right-2 p-1 text-text-muted opacity-0 group-hover/quote:opacity-100 focus:opacity-100 hover:text-danger transition-all"
                    title="Delete quote"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Update Progress Dialog ─────────────────────────────────────── */}
      <Dialog.Root open={showLogModal} onOpenChange={setShowLogModal}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-bg/85 backdrop-blur-sm" />
          <Dialog.Content
            className="fixed bottom-0 left-0 right-0 z-50 bg-surface border-t border-border rounded-t-2xl p-5 shadow-2xl sm:inset-auto sm:left-1/2 sm:-translate-x-1/2 sm:top-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-sm sm:rounded-2xl sm:border"
            style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
          >
            <div className="w-10 h-1 rounded-full bg-border mx-auto mb-4 sm:hidden" />
            <div className="flex items-center justify-between mb-5">
              <Dialog.Title className="text-base font-medium text-text">Update Progress</Dialog.Title>
              <Dialog.Close className="text-text-muted hover:text-text"><X size={18} /></Dialog.Close>
            </div>

            <form onSubmit={handleLogSession} className="space-y-4">
              <div>
                <label className="block text-xs text-text-muted mb-1.5 uppercase tracking-wider">
                  Current Page
                </label>
                <input
                  required autoFocus
                  type="number"
                  min="0"
                  max={book.total_pages ?? undefined}
                  value={currentPageInput}
                  onChange={e => setCurrentPageInput(e.target.value)}
                  placeholder={`e.g. ${Math.min((book.current_page || 0) + 20, book.total_pages || 999)}`}
                  className="selectable w-full bg-surface-2 border border-border rounded-xl px-4 py-3 text-text text-lg font-semibold focus:border-accent focus:outline-none"
                />
                {book.total_pages ? (
                  <p className="text-[11px] text-text-muted mt-1.5 text-right">
                    of {book.total_pages} total pages
                  </p>
                ) : null}
              </div>
              <button
                type="submit"
                disabled={updateBook.isPending}
                className="w-full py-3 bg-accent text-bg font-semibold rounded-xl hover:bg-accent-dim transition-colors disabled:opacity-50"
              >
                {updateBook.isPending ? 'Saving…' : 'Save Progress'}
              </button>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}
