import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ChevronLeft, BookOpen, ExternalLink, Plus, Loader, User, Calendar, Globe } from 'lucide-react'
import { useBooksQuery } from '../../hooks/useBooksQuery'
import { AddBookModal } from '../../components/books/AddBookModal'
import clsx from 'clsx'

// ─── Open Library types ───────────────────────────────────────────────────────
interface OLAuthorSearchResult {
  key: string
  name: string
  birth_date?: string
  death_date?: string
  work_count?: number
  top_subjects?: string[]
  top_work?: string
}

interface OLAuthorDetails {
  key: string
  name: string
  birth_date?: string
  death_date?: string
  bio?: string | { value: string }
  photos?: number[]
  wikipedia?: string
  alternate_names?: string[]
}

interface OLWork {
  key: string
  title: string
  covers?: number[]
  first_publish_year?: number
}

// ─── API helpers ──────────────────────────────────────────────────────────────
async function searchAuthor(name: string): Promise<OLAuthorSearchResult | null> {
  const res = await fetch(
    `https://openlibrary.org/search/authors.json?q=${encodeURIComponent(name)}&limit=5`
  )
  const json = await res.json()
  const docs: OLAuthorSearchResult[] = json.docs ?? []
  if (docs.length === 0) return null
  const exact = docs.find(d => d.name.toLowerCase() === name.toLowerCase())
  return exact ?? docs[0]
}

async function fetchAuthorDetails(olid: string): Promise<OLAuthorDetails> {
  const res = await fetch(`https://openlibrary.org/authors/${olid}.json`)
  return res.json()
}

async function fetchAuthorWorks(olid: string, limit = 24): Promise<OLWork[]> {
  const res = await fetch(
    `https://openlibrary.org/authors/${olid}/works.json?limit=${limit}`
  )
  const json = await res.json()
  return json.entries ?? []
}

function olCoverUrl(coverId: number) {
  return `https://covers.openlibrary.org/b/id/${coverId}-M.jpg`
}

function authorPhotoUrl(olid: string) {
  return `https://covers.openlibrary.org/a/olid/${olid}-M.jpg`
}

function extractBio(bio: OLAuthorDetails['bio']): string | null {
  if (!bio) return null
  if (typeof bio === 'string') return bio
  if (typeof bio === 'object' && 'value' in bio) return bio.value
  return null
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, string> = {
    'reading':   'bg-info/10 text-info border-info/20',
    'finished':  'bg-success/10 text-success border-success/20',
    'to-read':   'bg-surface-2 text-text-muted border-border',
    'abandoned': 'bg-warning/10 text-warning border-warning/20',
  }
  const labels: Record<string, string> = {
    'reading': 'Reading', 'finished': 'Read', 'to-read': 'To Read', 'abandoned': 'Abandoned',
  }
  return (
    <span className={clsx('text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border', cfg[status] ?? cfg['to-read'])}>
      {labels[status] ?? status}
    </span>
  )
}

function BookCover({ coverUrl, title }: { coverUrl?: string | null; title: string }) {
  return (
    <div className="w-full aspect-[3/4] rounded-lg overflow-hidden bg-surface-2 border border-border flex items-center justify-center shadow-sm">
      {coverUrl ? (
        <img src={coverUrl} alt={title} className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
      ) : (
        <span className="text-2xl opacity-20">📘</span>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export function AuthorPage() {
  const { authorName } = useParams<{ authorName: string }>()
  const navigate = useNavigate()
  const name = decodeURIComponent(authorName ?? '')

  const { data: allBooks = [] } = useBooksQuery()

  const [authorResult, setAuthorResult] = useState<OLAuthorSearchResult | null>(null)
  const [authorDetails, setAuthorDetails] = useState<OLAuthorDetails | null>(null)
  const [works, setWorks] = useState<OLWork[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [imgError, setImgError] = useState(false)

  const [addOpen, setAddOpen] = useState(false)
  const [prefilledTitle, setPrefilledTitle] = useState('')
  const [prefilledCover, setPrefilledCover] = useState<string | undefined>()

  useEffect(() => {
    if (!name) return
    setLoading(true)
    setError(null)
    setImgError(false)

    ;(async () => {
      try {
        const result = await searchAuthor(name)
        if (!result) { setError('Author not found'); setLoading(false); return }
        setAuthorResult(result)

        const olid = result.key.replace('/authors/', '')
        const [details, authorWorks] = await Promise.all([
          fetchAuthorDetails(olid),
          fetchAuthorWorks(olid, 24),
        ])
        setAuthorDetails(details)
        setWorks(authorWorks)
      } catch {
        setError('Could not load author data. Check your connection.')
      } finally {
        setLoading(false)
      }
    })()
  }, [name])

  const myBooks = useMemo(() => {
    if (!name) return []
    const n = name.toLowerCase()
    return allBooks.filter(b => b.author?.toLowerCase() === n)
  }, [allBooks, name])

  const myFinished  = myBooks.filter(b => b.status === 'finished')
  const myReading   = myBooks.filter(b => b.status === 'reading')
  const myToRead    = myBooks.filter(b => b.status === 'to-read')
  const myAbandoned = myBooks.filter(b => b.status === 'abandoned')

  const myTitles = useMemo(() => new Set(myBooks.map(b => b.title.toLowerCase())), [myBooks])
  const otherWorks = works.filter(w => !myTitles.has(w.title.toLowerCase()))

  const olid = authorResult?.key.replace('/authors/', '') ?? null
  const photoUrl = olid ? authorPhotoUrl(olid) : null
  const bio = authorDetails ? extractBio(authorDetails.bio) : null
  const wikiUrl = authorDetails?.wikipedia

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <Loader size={28} className="text-accent animate-spin" />
        <p className="text-sm text-text-secondary">Loading author…</p>
      </div>
    )
  }

  if (error || !authorResult) {
    return (
      <div className="space-y-4 max-w-xl mx-auto py-12 text-center">
        <User size={40} className="text-text-muted mx-auto" />
        <p className="text-text-secondary text-sm">{error ?? 'Author not found.'}</p>
        <button onClick={() => navigate('/books')}
          className="px-4 py-2 bg-surface-2 border border-border text-xs rounded-xl font-medium text-text hover:text-accent transition-colors">
          Back to Library
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-8 lg:max-w-4xl pb-10">
      {/* Back */}
      <button onClick={() => navigate(-1)}
        className="flex items-center gap-1 text-xs font-semibold text-text-secondary hover:text-text transition-colors">
        <ChevronLeft size={16} /> Back
      </button>

      {/* ── Author Hero ───────────────────────────────────────────────── */}
      <div className="bg-surface border border-border rounded-3xl overflow-hidden shadow-[var(--shadow-card)]">
        {/* Decorative gradient strip */}
        <div className="h-24 relative" style={{ background: 'linear-gradient(135deg, var(--color-accent) 0%, transparent 70%)', opacity: 0.18 }} />
        <div className="absolute top-0 left-0 right-0 h-24" style={{ background: 'linear-gradient(135deg, var(--color-accent) 0%, transparent 70%)', opacity: 0.18 }} />

        <div className="px-6 pb-6 -mt-12 flex flex-col sm:flex-row items-start sm:items-end gap-5">
          {/* Author photo */}
          <div className="w-24 h-24 rounded-2xl overflow-hidden bg-gradient-to-br from-accent/20 to-accent/5 border-4 border-surface flex-shrink-0 shadow-xl flex items-center justify-center">
            {!imgError && photoUrl ? (
              <img
                src={photoUrl}
                alt={name}
                className="w-full h-full object-cover"
                onError={() => setImgError(true)}
              />
            ) : (
              <span className="text-3xl">✍️</span>
            )}
          </div>

          <div className="flex-1 min-w-0 space-y-1.5">
            <h1 className="text-2xl font-display font-bold text-text leading-tight">{authorResult.name}</h1>

            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-muted">
              {(authorDetails?.birth_date ?? authorResult.birth_date) && (
                <span className="flex items-center gap-1">
                  <Calendar size={11} />
                  {authorDetails?.birth_date ?? authorResult.birth_date}
                  {(authorDetails?.death_date ?? authorResult.death_date) && (
                    <> — {authorDetails?.death_date ?? authorResult.death_date}</>
                  )}
                </span>
              )}
              {authorResult.work_count && (
                <span className="flex items-center gap-1">
                  <BookOpen size={11} />
                  {authorResult.work_count.toLocaleString()} works
                </span>
              )}
              {wikiUrl && (
                <a href={wikiUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 text-accent hover:underline">
                  <Globe size={11} /> Wikipedia <ExternalLink size={9} />
                </a>
              )}
            </div>

            {authorDetails?.alternate_names && authorDetails.alternate_names.length > 0 && (
              <p className="text-[11px] text-text-muted italic">
                Also: {authorDetails.alternate_names.slice(0, 3).join(', ')}
              </p>
            )}
          </div>
        </div>

        {/* Bio */}
        {bio && (
          <div className="px-6 pb-5">
            <div className="border-t border-border/60 pt-4">
              <p className="text-sm text-text-secondary leading-relaxed">
                {bio.replace(/\[.*?\]\(.*?\)/g, '').replace(/\n+/g, ' ').trim().slice(0, 600)}
                {bio.length > 600 && '…'}
              </p>
            </div>
          </div>
        )}

        {/* Subject tags */}
        {authorResult.top_subjects && authorResult.top_subjects.length > 0 && (
          <div className="px-6 pb-5 flex flex-wrap gap-1.5">
            {authorResult.top_subjects.slice(0, 8).map(s => (
              <span key={s} className="text-[10px] px-2.5 py-0.5 bg-accent/8 text-accent border border-accent/15 rounded-full font-medium">
                {s}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ── Your Library ─────────────────────────────────────────────── */}
      {myBooks.length > 0 && (
        <section className="space-y-5">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-text-muted">Your Library</h2>
            <span className="text-[10px] bg-accent/10 text-accent border border-accent/20 px-2 py-0.5 rounded-full font-semibold">
              {myBooks.length} book{myBooks.length !== 1 ? 's' : ''}
            </span>
          </div>

          {myReading.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-bold text-info uppercase tracking-wider pl-1">Currently Reading</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {myReading.map(book => (
                  <button key={book.id} onClick={() => navigate(`/books/${book.id}`)} className="text-left group space-y-2">
                    <BookCover coverUrl={book.cover_url} title={book.title} />
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-text leading-snug truncate group-hover:text-accent transition-colors">{book.title}</p>
                      <StatusBadge status="reading" />
                      {book.total_pages && book.current_page ? (
                        <div className="mt-1 h-1 bg-surface-2 rounded-full overflow-hidden">
                          <div className="h-full bg-info/60 rounded-full" style={{ width: `${Math.min(100, Math.round((book.current_page / book.total_pages) * 100))}%` }} />
                        </div>
                      ) : null}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {myFinished.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-bold text-success uppercase tracking-wider pl-1">Read</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {myFinished.map(book => (
                  <button key={book.id} onClick={() => navigate(`/books/${book.id}`)} className="text-left group space-y-2">
                    <BookCover coverUrl={book.cover_url} title={book.title} />
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-text leading-snug truncate group-hover:text-accent transition-colors">{book.title}</p>
                      <div className="flex items-center gap-1.5">
                        <StatusBadge status="finished" />
                        {book.rating && <span className="text-[10px] text-warning font-bold">{'★'.repeat(book.rating)}</span>}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {myToRead.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-bold text-text-muted uppercase tracking-wider pl-1">To Read</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {myToRead.map(book => (
                  <button key={book.id} onClick={() => navigate(`/books/${book.id}`)} className="text-left group space-y-2">
                    <BookCover coverUrl={book.cover_url} title={book.title} />
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-text leading-snug truncate group-hover:text-accent transition-colors">{book.title}</p>
                      <StatusBadge status="to-read" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {myAbandoned.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-bold text-warning uppercase tracking-wider pl-1">Abandoned</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {myAbandoned.map(book => (
                  <button key={book.id} onClick={() => navigate(`/books/${book.id}`)} className="text-left group space-y-2">
                    <BookCover coverUrl={book.cover_url} title={book.title} />
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-text leading-snug truncate group-hover:text-accent transition-colors">{book.title}</p>
                      <StatusBadge status="abandoned" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* ── Other Works from Open Library ────────────────────────────── */}
      {otherWorks.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-text-muted">
            More by {authorResult.name}
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {otherWorks.map(work => {
              const coverUrl = work.covers?.[0] ? olCoverUrl(work.covers[0]) : null
              return (
                <div key={work.key} className="group space-y-2">
                  <div className="relative">
                    <BookCover coverUrl={coverUrl} title={work.title} />
                    <button
                      onClick={() => {
                        setPrefilledTitle(work.title)
                        setPrefilledCover(coverUrl ?? undefined)
                        setAddOpen(true)
                      }}
                      className="absolute inset-0 flex items-end justify-center pb-2 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg"
                      style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 60%)' }}
                    >
                      <span className="flex items-center gap-1 bg-accent text-bg text-[10px] font-bold px-2.5 py-1.5 rounded-full shadow-lg">
                        <Plus size={10} /> Add to Library
                      </span>
                    </button>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-text leading-snug line-clamp-2">{work.title}</p>
                    {work.first_publish_year && (
                      <p className="text-[10px] text-text-muted mt-0.5">{work.first_publish_year}</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {myBooks.length === 0 && otherWorks.length === 0 && (
        <div className="text-center py-12 space-y-3">
          <BookOpen size={36} className="text-text-muted mx-auto" />
          <p className="text-sm text-text-secondary">No books found for this author.</p>
        </div>
      )}

      {/* AddBookModal pre-filled from other works */}
      <AddBookModal
        open={addOpen}
        onOpenChange={open => { setAddOpen(open); if (!open) { setPrefilledTitle(''); setPrefilledCover(undefined) } }}
        prefillTitle={prefilledTitle}
        prefillAuthor={name}
        prefillCoverUrl={prefilledCover}
      />
    </div>
  )
}
