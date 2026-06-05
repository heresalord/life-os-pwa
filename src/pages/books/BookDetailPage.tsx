import React, { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import * as Dialog from '@radix-ui/react-dialog'
import { 
  ChevronLeft, Calendar, Clock, Quote as QuoteIcon, 
  Trash2, Plus, X, Award, BarChart3
} from 'lucide-react'
import { useBookQuery } from '../../hooks/useBooksQuery'
import { useBookMutations } from '../../hooks/useBookMutations'
import { useQuotesQuery } from '../../hooks/useQuotesQuery'
import { useQuoteMutations } from '../../hooks/useQuoteMutations'
import { Star } from 'lucide-react'
import { haptic } from '../../lib/haptic'
import clsx from 'clsx'

// ── Types ─────────────────────────────────────────────────────────────────
interface ReadingSession {
  date: string
  pages_read: number
  minutes: number
}

const SOURCE_LABELS: Record<'physical' | 'ebook' | 'audiobook' | 'library', string> = {
  physical:  '📚 Physical',
  ebook:     '📱 E-Book',
  audiobook: '🎧 Audiobook',
  library:   '🏛️ Library',
}

// ── Star rating read-only widget ──────────────────────────────────────────
function StarRating({ value, size = 16 }: { value: number | null; size?: number }) {
  if (!value) return null
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(n => (
        <Star
          key={n}
          size={size}
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

  const [sessionPages, setSessionPages] = useState('')
  const [sessionMinutes, setSessionMinutes] = useState('')
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
        <button 
          onClick={() => navigate('/books')}
          className="px-4 py-2 bg-surface-2 border border-border text-xs rounded-xl font-medium text-text hover:text-accent transition-colors"
        >
          Back to Library
        </button>
      </div>
    )
  }

  // Cast reading_sessions from Json to a typed array, filtering out any malformed entries
  const sessions: ReadingSession[] = Array.isArray(book.reading_sessions)
    ? (book.reading_sessions as unknown[]).filter(
        (s): s is ReadingSession =>
          s !== null &&
          typeof s === 'object' &&
          'pages_read' in (s as object) &&
          'minutes' in (s as object)
      )
    : []

  const totalMinutes  = sessions.reduce((sum, s) => sum + (s.minutes || 0), 0)
  const totalPagesRead = sessions.reduce((sum, s) => sum + (s.pages_read || 0), 0)
  const speed = totalMinutes > 0 ? (totalPagesRead / (totalMinutes / 60)) : 0
  const pagesLeft = book.total_pages ? Math.max(0, book.total_pages - book.current_page) : 0
  const timeLeftMinutes = speed > 0 ? (pagesLeft / speed) * 60 : 0

  const handleLogSession = async (e: React.FormEvent) => {
    e.preventDefault()
    const p = parseInt(sessionPages)
    const m = parseInt(sessionMinutes)
    if (isNaN(p) || p <= 0 || isNaN(m) || m <= 0) return

    const newSession: ReadingSession = {
      date: new Date().toISOString().split('T')[0],
      pages_read: p,
      minutes: m,
    }
    const newSessions = [...sessions, newSession]
    const newCurrentPage = Math.min((book.current_page || 0) + p, book.total_pages || 99999)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updates: any = { current_page: newCurrentPage, reading_sessions: newSessions }

    if (book.total_pages && newCurrentPage >= book.total_pages && book.status !== 'finished') {
      updates.status = 'finished'
      updates.finished_at = new Date().toISOString().split('T')[0]
      updates.reflection = `**What I learned:**\nAuto-completed via logged session.\n\n**What I'll remember:**\n(Click edit to write reflection)\n\n**Would I recommend it?**\nYes.`
    }

    await updateBook.mutateAsync({ id: book.id, updates })
    setSessionPages('')
    setSessionMinutes('')
    setShowLogModal(false)
    haptic('success')
  }

  const handleDeleteSession = async (index: number) => {
    if (!window.confirm('Delete this reading session? Your progress will adjust back.')) return

    const session = sessions[index]
    if (!session) return

    const newSessions = sessions.filter((_, i) => i !== index)
    const pagesRead = session.pages_read || 0
    const newCurrentPage = Math.max(0, (book.current_page || 0) - pagesRead)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updates: any = { current_page: newCurrentPage, reading_sessions: newSessions }

    if (book.status === 'finished' && book.total_pages && newCurrentPage < book.total_pages) {
      updates.status = 'reading'
      updates.finished_at = null
    }

    await updateBook.mutateAsync({ id: book.id, updates })
    haptic('medium')
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

  const formatTimeLeft = (mins: number) => {
    if (mins <= 0) return 'Finished'
    const h = Math.floor(mins / 60)
    const m = Math.round(mins % 60)
    return h === 0 ? `${m}m left` : `${h}h ${m}m left`
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

  // Only look up the label if source is a known valid key
  const sourceLabel = book.source ? (SOURCE_LABELS[book.source] ?? null) : null

  // Cast shelves from Json to string[]
  const shelves: string[] = Array.isArray(book.shelves)
    ? (book.shelves as unknown[]).filter((s): s is string => typeof s === 'string')
    : []

  return (
    <div className="space-y-6 lg:max-w-5xl">
      <button 
        onClick={() => navigate('/books')}
        className="flex items-center gap-1 text-xs font-semibold text-text-secondary hover:text-text transition-colors"
      >
        <ChevronLeft size={16} /> Back to Library
      </button>

      {/* Hero Header */}
      <div className="bg-surface border border-border rounded-2xl p-5 md:p-6 shadow-sm flex flex-col md:flex-row gap-5 items-start">
        <div className="w-24 h-36 md:w-28 md:h-40 rounded-xl overflow-hidden bg-surface-2 border border-border flex items-center justify-center flex-shrink-0 mx-auto md:mx-0 shadow-md">
          {book.cover_url
            ? <img src={book.cover_url} alt="" className="w-full h-full object-cover" />
            : <span className="text-3xl opacity-25">📘</span>
          }
        </div>

        <div className="flex-1 min-w-0 text-center md:text-left space-y-2.5">
          <div>
            <h1 className="text-xl md:text-2xl font-display text-text font-bold leading-snug">{book.title}</h1>
            {book.author && <p className="text-sm text-text-secondary mt-0.5">by {book.author}</p>}
          </div>

          <div className="flex flex-wrap justify-center md:justify-start gap-1.5 items-center">
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
            <div className="flex justify-center md:justify-start">
              <StarRating value={book.rating} size={15} />
            </div>
          )}

          {shelves.length > 0 && (
            <div className="flex flex-wrap justify-center md:justify-start gap-1">
              {shelves.map(shelf => (
                <span key={shelf} className="text-[9px] bg-surface-2 border border-border text-text-muted px-2 py-0.5 rounded-md font-medium">
                  📁 {shelf}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="w-full md:w-auto flex flex-col gap-2 flex-shrink-0 self-stretch justify-center">
          {book.status === 'reading' && (
            <button 
              onClick={() => { haptic('light'); setShowLogModal(true) }}
              className="w-full md:px-4 py-2.5 bg-accent text-bg font-semibold text-xs rounded-xl hover:bg-accent-dim transition-colors flex items-center justify-center gap-1.5 shadow-sm"
            >
              <Plus size={14} /> Log Reading Session
            </button>
          )}
        </div>
      </div>

      {/* Two column detail layout */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Left / Main Column */}
        <div className="md:col-span-2 space-y-5">
          <div className="bg-surface border border-border p-4 rounded-2xl shadow-sm space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted flex items-center gap-1.5">
              <BarChart3 size={14} /> Reading Progress
            </h3>
            <div className="flex justify-between items-end text-xs text-text-secondary">
              <span>Page {book.current_page} of {book.total_pages || 'unknown'}</span>
              {book.total_pages ? (
                <span className="font-bold text-text">
                  {Math.min(100, Math.round((book.current_page / book.total_pages) * 100))}%
                </span>
              ) : null}
            </div>
            {book.total_pages ? (
              <div className="h-2 bg-surface-2 rounded-full overflow-hidden border border-border">
                <div 
                  className="h-full bg-info/60 rounded-full transition-all duration-500 ease-out" 
                  style={{ width: `${Math.min(100, Math.round((book.current_page / book.total_pages) * 100))}%` }} 
                />
              </div>
            ) : null}
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/40 text-center">
              <div>
                <p className="text-[9px] text-text-muted uppercase tracking-wider">Speed</p>
                <p className="text-sm font-semibold text-text mt-0.5">{speed > 0 ? `${Math.round(speed)} p/h` : '—'}</p>
              </div>
              <div>
                <p className="text-[9px] text-text-muted uppercase tracking-wider">Total Time</p>
                <p className="text-sm font-semibold text-text mt-0.5">
                  {totalMinutes >= 60 ? `${Math.round(totalMinutes / 60)}h` : `${totalMinutes}m`}
                </p>
              </div>
              <div>
                <p className="text-[9px] text-text-muted uppercase tracking-wider">Remaining</p>
                <p className="text-sm font-semibold text-text mt-0.5">
                  {book.total_pages ? formatTimeLeft(timeLeftMinutes) : '—'}
                </p>
              </div>
            </div>
          </div>

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

          {book.status === 'abandoned' && book.abandon_reason && (
            <div className="bg-surface border border-border p-4 rounded-2xl shadow-sm">
              <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted">Reason for Abandoning</h3>
              <p className="text-sm text-text mt-2 italic">"{book.abandon_reason}"</p>
            </div>
          )}

          <div className="bg-surface border border-border p-4 rounded-2xl shadow-sm space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted flex items-center gap-1.5">
              <Clock size={14} /> Session History
            </h3>
            {sessions.length === 0 ? (
              <p className="text-xs text-text-muted italic py-2">No reading sessions logged yet.</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {sessions.map((s, i) => {
                  const sSpeed = s.minutes > 0 ? (s.pages_read * 60) / s.minutes : 0
                  return (
                    <div key={i} className="group flex items-center justify-between gap-3 bg-surface-2 border border-border/60 p-2.5 rounded-xl text-xs">
                      <div className="flex items-center gap-3">
                        <Calendar size={13} className="text-text-muted" />
                        <div>
                          <p className="font-semibold text-text">{s.date}</p>
                          <p className="text-[10px] text-text-muted">
                            {s.pages_read} pages · {s.minutes} mins{sSpeed > 0 ? ` (${Math.round(sSpeed)} p/h)` : ''}
                          </p>
                        </div>
                      </div>
                      <button 
                        onClick={() => handleDeleteSession(i)}
                        className="p-1 text-text-muted hover:text-danger opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Delete session"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-5">
          <div className="bg-surface border border-border p-4 rounded-2xl shadow-sm space-y-3.5 text-xs">
            <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted">Details</h3>
            <div className="space-y-2">
              <div className="flex justify-between border-b border-border/40 pb-2">
                <span className="text-text-secondary">Language</span>
                <span className="text-text font-semibold">{book.language || '—'}</span>
              </div>
              <div className="flex justify-between border-b border-border/40 pb-2">
                <span className="text-text-secondary">ISBN</span>
                <span className="text-text font-semibold font-mono">{book.isbn || '—'}</span>
              </div>
              <div className="flex justify-between border-b border-border/40 pb-2">
                <span className="text-text-secondary">Added on</span>
                <span className="text-text font-semibold">{book.added_at}</span>
              </div>
              {book.started_at && (
                <div className="flex justify-between border-b border-border/40 pb-2">
                  <span className="text-text-secondary">Started</span>
                  <span className="text-text font-semibold">{book.started_at}</span>
                </div>
              )}
              {book.finished_at && (
                <div className="flex justify-between border-b border-border/40 pb-2">
                  <span className="text-text-secondary">Finished</span>
                  <span className="text-text font-semibold">{book.finished_at}</span>
                </div>
              )}
            </div>
          </div>

          <div className="bg-surface border border-border p-4 rounded-2xl shadow-sm space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted flex items-center gap-1.5">
              <QuoteIcon size={14} /> Quotes
            </h3>
            <form onSubmit={handleAddQuote} className="space-y-2">
              <textarea
                required
                rows={2}
                value={quoteText}
                onChange={e => setQuoteText(e.target.value)}
                placeholder="Type or paste a quote…"
                className="selectable w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-xs text-text placeholder-text-muted focus:border-accent focus:outline-none resize-none"
              />
              <div className="flex gap-2">
                <input
                  type="number"
                  min="1"
                  value={quotePage}
                  onChange={e => setQuotePage(e.target.value)}
                  placeholder="Page #"
                  className="selectable w-20 bg-surface-2 border border-border rounded-xl px-2.5 py-1.5 text-xs text-text placeholder-text-muted focus:border-accent focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={!quoteText.trim() || addQuote.isPending}
                  className="flex-1 py-1.5 bg-accent text-bg font-semibold text-xs rounded-xl hover:bg-accent-dim transition-colors disabled:opacity-40"
                >
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

      {/* Log Session Dialog */}
      <Dialog.Root open={showLogModal} onOpenChange={setShowLogModal}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-bg/85 backdrop-blur-sm" />
          <Dialog.Content
            className="fixed bottom-0 left-0 right-0 z-50 bg-surface border-t border-border rounded-t-2xl p-5 shadow-2xl sm:inset-auto sm:left-1/2 sm:-translate-x-1/2 sm:top-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-md sm:rounded-2xl sm:border"
            style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
          >
            <div className="w-10 h-1 rounded-full bg-border mx-auto mb-4 sm:hidden" />
            <div className="flex items-center justify-between mb-4">
              <Dialog.Title className="text-base font-medium text-text">Log Reading Session</Dialog.Title>
              <Dialog.Close className="text-text-muted hover:text-text"><X size={18} /></Dialog.Close>
            </div>
            <form onSubmit={handleLogSession} className="space-y-4">
              <div>
                <label className="block text-xs text-text-muted mb-1.5 uppercase tracking-wider">Pages Read</label>
                <input
                  required
                  autoFocus
                  type="number"
                  min="1"
                  max={book.total_pages ? Math.max(1, book.total_pages - book.current_page) : undefined}
                  value={sessionPages}
                  onChange={e => setSessionPages(e.target.value)}
                  placeholder="How many pages did you read?"
                  className="selectable w-full bg-surface-2 border border-border rounded-xl px-4 py-3 text-text focus:border-accent focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1.5 uppercase tracking-wider">Time Spent (Minutes)</label>
                <input
                  required
                  type="number"
                  min="1"
                  value={sessionMinutes}
                  onChange={e => setSessionMinutes(e.target.value)}
                  placeholder="How many minutes did you read?"
                  className="selectable w-full bg-surface-2 border border-border rounded-xl px-4 py-3 text-text focus:border-accent focus:outline-none"
                />
              </div>
              <button 
                type="submit"
                className="w-full py-3 bg-accent text-bg font-medium rounded-xl hover:bg-accent-dim transition-colors"
              >
                Log Session
              </button>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}
