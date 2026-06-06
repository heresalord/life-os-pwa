import React, { useState, useMemo, useEffect } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { BookOpen, Search, X, SlidersHorizontal, Award, Star } from 'lucide-react'
import { useBooksQuery } from '../../hooks/useBooksQuery'
import { useBookMutations } from '../../hooks/useBookMutations'
import { BookItem } from '../../components/books/BookItem'
import { AddBookModal } from '../../components/books/AddBookModal'
import { EmptyState } from '../../components/EmptyState'
import { useReadingGoalsQuery, useSaveReadingGoalMutation } from '../../hooks/useReadingGoalsQuery'
import { haptic } from '../../lib/haptic'
import clsx from 'clsx'

type TabStatus = 'reading' | 'to-read' | 'finished' | 'abandoned' | 'stats'

const TABS: { value: TabStatus; label: string }[] = [
  { value: 'reading',   label: 'Reading'   },
  { value: 'to-read',   label: 'To Read'   },
  { value: 'finished',  label: 'Finished'  },
  { value: 'abandoned', label: 'Abandoned' },
  { value: 'stats',     label: 'Stats'     },
]

const EMPTY_MESSAGES: Record<Exclude<TabStatus, 'stats'>, string> = {
  'reading':   'No books in progress. Start one!',
  'to-read':   'Your reading list is empty.',
  'finished':  'No finished books yet.',
  'abandoned': 'Nothing abandoned — nice.',
}

export function BooksPage() {
  const [tab, setTab] = useState<TabStatus>('reading')
  const { data: allBooks = [], isLoading } = useBooksQuery()
  const { deleteBook } = useBookMutations()

  // Reading goals
  const { data: readingGoals = [] } = useReadingGoalsQuery()
  const currentYear = new Date().getFullYear()
  const yearlyGoal  = readingGoals.find(g => g.year === currentYear)
  const targetBooks = yearlyGoal?.target_books || 0

  const [showGoalModal, setShowGoalModal] = useState(false)
  const [goalBooks, setGoalBooks] = useState('')
  const [goalPages, setGoalPages] = useState('')
  const saveGoal = useSaveReadingGoalMutation()

  useEffect(() => {
    if (yearlyGoal) {
      setGoalBooks(yearlyGoal.target_books.toString())
      setGoalPages(yearlyGoal.target_pages?.toString() || '')
    }
  }, [yearlyGoal])

  // Sorting & Filtering
  const [sortBy, setSortBy]           = useState<'added' | 'rating' | 'pages' | 'title'>('added')
  const [filterGenre, setFilterGenre] = useState<string>('all')
  const [filterSource, setFilterSource] = useState<string>('all')
  const [filterShelf, setFilterShelf] = useState<string>('all')
  const [filterYear, setFilterYear]   = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [showFilters, setShowFilters] = useState<boolean>(false)

  const completedThisYear = useMemo(() =>
    allBooks.filter(b => b.status === 'finished' && b.finished_at?.startsWith(String(currentYear))).length,
    [allBooks, currentYear]
  )

  const genres = useMemo(() => {
    const set = new Set<string>()
    allBooks.forEach(b => { if (b.genre) set.add(b.genre.trim()) })
    return Array.from(set).sort()
  }, [allBooks])

  const shelves = useMemo(() => {
    const set = new Set<string>()
    allBooks.forEach(b => {
      if (Array.isArray(b.shelves)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(b.shelves as any[]).forEach((s: any) => { if (typeof s === 'string') set.add(s.trim()) })
      }
    })
    return Array.from(set).sort()
  }, [allBooks])

  const yearsFinished = useMemo(() => {
    const set = new Set<string>()
    allBooks.forEach(b => {
      if (b.status === 'finished' && b.finished_at) {
        const y = b.finished_at.split('-')[0]
        if (y) set.add(y)
      }
    })
    return Array.from(set).sort((a, b) => b.localeCompare(a))
  }, [allBooks])

  const processedBooks = useMemo(() => {
    if (tab === 'stats') return []
    let result = allBooks.filter(b => b.status === tab)

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(b =>
        b.title.toLowerCase().includes(q) || (b.author && b.author.toLowerCase().includes(q))
      )
    }
    if (filterGenre  !== 'all') result = result.filter(b => b.genre?.trim() === filterGenre)
    if (filterSource !== 'all') result = result.filter(b => b.source === filterSource)
    if (filterShelf  !== 'all') result = result.filter(b => Array.isArray(b.shelves) && b.shelves.includes(filterShelf))
    if (filterYear   !== 'all' && tab === 'finished') result = result.filter(b => b.finished_at?.startsWith(filterYear))

    result.sort((a, b) => {
      if (sortBy === 'title')  return a.title.localeCompare(b.title)
      if (sortBy === 'rating') return (b.rating ?? 0) - (a.rating ?? 0)
      if (sortBy === 'pages')  return (b.total_pages ?? 0) - (a.total_pages ?? 0)
      return (b.added_at || '').localeCompare(a.added_at || '')
    })
    return result
  }, [allBooks, tab, searchQuery, filterGenre, filterSource, filterShelf, filterYear, sortBy])

  // ── Stats (page-based, no sessions) ───────────────────────────────────
  const stats = useMemo(() => {
    const byStatus = {
      reading:   allBooks.filter(b => b.status === 'reading').length,
      'to-read': allBooks.filter(b => b.status === 'to-read').length,
      finished:  allBooks.filter(b => b.status === 'finished').length,
      abandoned: allBooks.filter(b => b.status === 'abandoned').length,
    }

    // Pages: sum of total_pages for finished books (best proxy we have)
    const totalPagesFinished = allBooks
      .filter(b => b.status === 'finished' && b.total_pages)
      .reduce((s, b) => s + (b.total_pages || 0), 0)

    // Average rating of rated finished books
    const ratedBooks = allBooks.filter(b => b.status === 'finished' && b.rating)
    const avgRating = ratedBooks.length
      ? ratedBooks.reduce((s, b) => s + (b.rating || 0), 0) / ratedBooks.length
      : null

    // Currently reading with progress
    const currentlyReading = allBooks
      .filter(b => b.status === 'reading')
      .map(b => {
        const pct = b.total_pages && b.current_page
          ? Math.min(100, Math.round((b.current_page / b.total_pages) * 100))
          : 0
        return { ...b, pct }
      })

    return { byStatus, totalPagesFinished, avgRating, currentlyReading }
  }, [allBooks])

  const handleSaveGoal = (e: React.FormEvent) => {
    e.preventDefault()
    const b = parseInt(goalBooks)
    if (isNaN(b) || b <= 0) return
    haptic('medium')
    saveGoal.mutate(
      { year: currentYear, target_books: b, target_pages: goalPages ? parseInt(goalPages) : null },
      { onSuccess: () => setShowGoalModal(false) }
    )
  }

  // Progress ring
  const radius = 22, stroke = 3.5
  const normalizedRadius = radius - stroke * 2
  const circumference = normalizedRadius * 2 * Math.PI
  const pct = targetBooks > 0 ? Math.min(Math.round((completedThisYear / targetBooks) * 100), 100) : 0
  const strokeDashoffset = circumference - (pct / 100) * circumference

  return (
    <div className="space-y-4 lg:max-w-4xl">
      <header className="flex items-center justify-between border-b border-border/40 pb-4">
        <div>
          <h1 className="text-2xl font-display text-text">Library</h1>
          <p className="text-xs text-text-secondary mt-0.5">
            {allBooks.length} book{allBooks.length !== 1 ? 's' : ''} total
          </p>
        </div>

        {targetBooks > 0 ? (
          <button
            onClick={() => { haptic('light'); setShowGoalModal(true) }}
            className="flex items-center gap-3 bg-surface border border-border px-3.5 py-1.5 rounded-xl hover:border-accent transition-all hover:shadow-sm"
          >
            <div className="relative flex items-center justify-center">
              <svg height={radius * 2} width={radius * 2} className="transform -rotate-90">
                <circle stroke="var(--color-border)" fill="transparent" strokeWidth={stroke} r={normalizedRadius} cx={radius} cy={radius} />
                <circle stroke="var(--color-success)" fill="transparent" strokeWidth={stroke}
                  strokeDasharray={`${circumference} ${circumference}`}
                  style={{ strokeDashoffset }}
                  r={normalizedRadius} cx={radius} cy={radius}
                  className="transition-all duration-500 ease-out"
                />
              </svg>
              <span className="absolute text-[9px] font-bold text-text-secondary">{pct}%</span>
            </div>
            <div className="text-left">
              <p className="text-[9px] text-text-muted uppercase tracking-wider font-semibold">Reading Goal</p>
              <p className="text-xs font-semibold text-text">
                {completedThisYear} / {targetBooks} <span className="text-text-secondary text-[10px] font-normal">books</span>
              </p>
            </div>
          </button>
        ) : (
          <button
            onClick={() => { haptic('light'); setShowGoalModal(true) }}
            className="text-xs font-medium text-accent border border-accent/25 bg-accent/5 hover:bg-accent/10 hover:border-accent/40 transition-colors px-3 py-1.5 rounded-xl flex items-center gap-1.5"
          >
            <Award size={14} /> Set Reading Goal
          </button>
        )}
      </header>

      {/* ── Tab switcher — matches "list / calendar / time block" style ── */}
      <div className="flex bg-surface-2 p-1 rounded-xl gap-1 overflow-x-auto">
        {TABS.map(t => {
          const count = t.value !== 'stats' ? allBooks.filter(b => b.status === t.value).length : 0
          return (
            <button
              key={t.value}
              onClick={() => { haptic('light'); setTab(t.value) }}
              className={clsx(
                'flex-1 min-w-fit py-1.5 px-2.5 text-xs font-semibold rounded-lg whitespace-nowrap transition-all',
                tab === t.value
                  ? 'bg-surface text-text shadow-sm'
                  : 'text-text-muted hover:text-text-secondary'
              )}
            >
              {t.label}
              {t.value !== 'stats' && count > 0 && (
                <span className="ml-1.5 text-[10px] opacity-60">{count}</span>
              )}
            </button>
          )
        })}
      </div>

      {/* ── Book list panels ─────────────────────────────────────────────── */}
      {tab !== 'stats' && (
        <>
          <AddBookModal defaultStatus={tab === 'finished' || tab === 'abandoned' ? 'to-read' : tab} />

          {/* Sort & Filter */}
          <div className="bg-surface border border-border p-3.5 rounded-2xl space-y-3 shadow-sm">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search library…"
                  className="w-full bg-surface-2 border border-border rounded-xl pl-8 pr-4 py-2 text-xs text-text focus:outline-none focus:border-accent"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text">
                    <X size={13} />
                  </button>
                )}
              </div>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={clsx(
                  'flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border transition-colors',
                  showFilters ? 'border-accent bg-accent/10 text-accent' : 'border-border bg-surface-2 text-text-secondary hover:text-text'
                )}
              >
                <SlidersHorizontal size={13} /> Filters
              </button>
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as typeof sortBy)}
                className="bg-surface-2 border border-border rounded-xl px-2.5 py-2 text-xs font-semibold text-text focus:outline-none focus:border-accent appearance-none"
              >
                <option value="added">🕒 Added</option>
                <option value="rating">⭐️ Rating</option>
                <option value="pages">📖 Pages</option>
                <option value="title">🔤 Title</option>
              </select>
            </div>

            {showFilters && (
              <div className="flex flex-wrap gap-2 text-xs pt-1 border-t border-border/40 mt-2 animate-in fade-in duration-200">
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] uppercase tracking-wider text-text-muted font-bold pl-1">Genre</label>
                  <select value={filterGenre} onChange={e => setFilterGenre(e.target.value)}
                    className="bg-surface-2 border border-border rounded-lg px-2 py-1 text-text-secondary focus:outline-none">
                    <option value="all">All Genres</option>
                    {genres.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] uppercase tracking-wider text-text-muted font-bold pl-1">Source</label>
                  <select value={filterSource} onChange={e => setFilterSource(e.target.value)}
                    className="bg-surface-2 border border-border rounded-lg px-2 py-1 text-text-secondary focus:outline-none">
                    <option value="all">All Sources</option>
                    <option value="physical">Physical</option>
                    <option value="ebook">E-Book</option>
                    <option value="audiobook">Audiobook</option>
                    <option value="library">Library</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] uppercase tracking-wider text-text-muted font-bold pl-1">Shelf</label>
                  <select value={filterShelf} onChange={e => setFilterShelf(e.target.value)}
                    className="bg-surface-2 border border-border rounded-lg px-2 py-1 text-text-secondary focus:outline-none">
                    <option value="all">All Shelves</option>
                    {shelves.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                {tab === 'finished' && yearsFinished.length > 0 && (
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] uppercase tracking-wider text-text-muted font-bold pl-1">Year</label>
                    <select value={filterYear} onChange={e => setFilterYear(e.target.value)}
                      className="bg-surface-2 border border-border rounded-lg px-2 py-1 text-text-secondary focus:outline-none">
                      <option value="all">All Years</option>
                      {yearsFinished.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                  </div>
                )}
                <button
                  onClick={() => { setFilterGenre('all'); setFilterSource('all'); setFilterShelf('all'); setFilterYear('all'); setSearchQuery('') }}
                  className="self-end px-3 py-1.5 text-text-muted hover:text-text font-medium underline text-[11px]"
                >
                  Reset All
                </button>
              </div>
            )}
          </div>

          <div className="mt-4">
            {isLoading ? (
              <div className="flex justify-center p-8">
                <div className="w-6 h-6 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
              </div>
            ) : processedBooks.length === 0 ? (
              <EmptyState
                icon={<BookOpen size={40} />}
                title="No books matched"
                message={EMPTY_MESSAGES[tab as Exclude<TabStatus, 'stats'>]}
              />
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {processedBooks.map(b => (
                  <BookItem
                    key={b.id}
                    book={b as Parameters<typeof BookItem>[0]['book']}
                    onDelete={id => deleteBook.mutate(id)}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Stats panel ──────────────────────────────────────────────────── */}
      {tab === 'stats' && (
        <div className="space-y-5 animate-in fade-in duration-200">

          {/* Status breakdown */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {([ 
              { label: 'Reading',   count: stats.byStatus.reading,   color: 'text-info',    bg: 'bg-info/10'    },
              { label: 'To Read',   count: stats.byStatus['to-read'], color: 'text-accent',  bg: 'bg-accent/10'  },
              { label: 'Finished',  count: stats.byStatus.finished,  color: 'text-success', bg: 'bg-success/10' },
              { label: 'Abandoned', count: stats.byStatus.abandoned, color: 'text-warning', bg: 'bg-warning/10' },
            ] as const).map(({ label, count, color, bg }) => (
              <div key={label} className={clsx('border border-border rounded-2xl p-4 text-center shadow-sm', bg)}>
                <p className={clsx('text-3xl font-display font-bold', color)}>{count}</p>
                <p className="text-[10px] text-text-muted uppercase tracking-wider font-semibold mt-1">{label}</p>
              </div>
            ))}
          </div>

          {/* Key metrics */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="bg-surface border border-border p-4 rounded-2xl shadow-sm text-center">
              <p className="text-[10px] text-text-muted uppercase tracking-wider font-bold">Finished {currentYear}</p>
              <p className="text-3xl font-display text-text mt-2 font-bold">{completedThisYear}</p>
              {targetBooks > 0
                ? <p className="text-[10px] text-text-secondary mt-1">Goal: {targetBooks} books</p>
                : <p className="text-[10px] text-text-muted mt-1 italic">No goal set</p>
              }
            </div>

            <div className="bg-surface border border-border p-4 rounded-2xl shadow-sm text-center">
              <p className="text-[10px] text-text-muted uppercase tracking-wider font-bold">Pages Read</p>
              <p className="text-3xl font-display text-text mt-2 font-bold">
                {stats.totalPagesFinished >= 1000
                  ? `${(stats.totalPagesFinished / 1000).toFixed(1)}k`
                  : stats.totalPagesFinished}
              </p>
              <p className="text-[10px] text-text-secondary mt-1">across finished books</p>
            </div>

            <div className="bg-surface border border-border p-4 rounded-2xl shadow-sm text-center">
              <p className="text-[10px] text-text-muted uppercase tracking-wider font-bold">Avg Rating</p>
              {stats.avgRating ? (
                <>
                  <p className="text-3xl font-display text-text mt-2 font-bold">{stats.avgRating.toFixed(1)}</p>
                  <div className="flex justify-center mt-1 gap-0.5">
                    {[1,2,3,4,5].map(n => (
                      <Star key={n} size={10}
                        className={n <= Math.round(stats.avgRating!) ? 'text-warning fill-warning' : 'text-border'}
                        strokeWidth={1.5}
                      />
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <p className="text-3xl font-display text-text mt-2 font-bold">—</p>
                  <p className="text-[10px] text-text-muted mt-1 italic">No ratings yet</p>
                </>
              )}
            </div>

            <div className="bg-surface border border-border p-4 rounded-2xl shadow-sm text-center">
              <p className="text-[10px] text-text-muted uppercase tracking-wider font-bold">Library Size</p>
              <p className="text-3xl font-display text-text mt-2 font-bold">{allBooks.length}</p>
              <p className="text-[10px] text-text-secondary mt-1">books total</p>
            </div>

            {/* Goal progress */}
            {targetBooks > 0 && (
              <div className="bg-surface border border-border p-4 rounded-2xl shadow-sm text-center col-span-2 md:col-span-2">
                <p className="text-[10px] text-text-muted uppercase tracking-wider font-bold mb-3">
                  {currentYear} Goal Progress
                </p>
                <div className="h-2.5 bg-surface-2 rounded-full overflow-hidden border border-border mb-2">
                  <div
                    className="h-full bg-success/60 rounded-full transition-all duration-700 ease-out"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="text-xs font-semibold text-text">
                  {completedThisYear} / {targetBooks} books — {pct}%
                </p>
              </div>
            )}
          </div>

          {/* Currently reading progress */}
          {stats.currentlyReading.length > 0 && (
            <div className="bg-surface border border-border p-4 rounded-2xl shadow-sm">
              <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted mb-3">
                In Progress
              </h3>
              <div className="space-y-4">
                {stats.currentlyReading.map(b => (
                  <div key={b.id}>
                    <div className="flex justify-between items-baseline mb-1.5">
                      <p className="text-xs font-semibold text-text truncate max-w-[70%]">{b.title}</p>
                      <span className="text-[11px] font-bold text-text-secondary">{b.pct}%</span>
                    </div>
                    <div className="h-2 bg-surface-2 rounded-full overflow-hidden border border-border">
                      <div className="h-full bg-info/60 rounded-full transition-all duration-500" style={{ width: `${b.pct}%` }} />
                    </div>
                    {b.total_pages ? (
                      <p className="text-[10px] text-text-muted mt-1">
                        Page {b.current_page || 0} of {b.total_pages}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Reading Goal Modal ─────────────────────────────────────────── */}
      <Dialog.Root open={showGoalModal} onOpenChange={setShowGoalModal}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-bg/85 backdrop-blur-sm" />
          <Dialog.Content
            className="fixed bottom-0 left-0 right-0 z-50 bg-surface border-t border-border rounded-t-2xl p-5 shadow-2xl sm:inset-auto sm:left-1/2 sm:-translate-x-1/2 sm:top-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-md sm:rounded-2xl sm:border"
            style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
          >
            <div className="w-10 h-1 rounded-full bg-border mx-auto mb-4 sm:hidden" />
            <div className="flex items-center justify-between mb-4">
              <Dialog.Title className="text-base font-medium text-text">Set Reading Goal ({currentYear})</Dialog.Title>
              <Dialog.Close className="text-text-muted hover:text-text"><X size={18} /></Dialog.Close>
            </div>
            <form onSubmit={handleSaveGoal} className="space-y-4">
              <div>
                <label className="block text-xs text-text-muted mb-1.5 uppercase tracking-wider">Target Books</label>
                <input required type="number" min="1"
                  value={goalBooks} onChange={e => setGoalBooks(e.target.value)}
                  placeholder="e.g. 24"
                  className="selectable w-full bg-surface-2 border border-border rounded-xl px-4 py-3 text-text focus:border-accent focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1.5 uppercase tracking-wider">Target Pages (Optional)</label>
                <input type="number" min="1"
                  value={goalPages} onChange={e => setGoalPages(e.target.value)}
                  placeholder="e.g. 5000"
                  className="selectable w-full bg-surface-2 border border-border rounded-xl px-4 py-3 text-text focus:border-accent focus:outline-none"
                />
              </div>
              <button type="submit" disabled={saveGoal.isPending}
                className="w-full py-3 bg-accent text-bg font-medium rounded-xl hover:bg-accent-dim transition-colors disabled:opacity-50">
                {saveGoal.isPending ? 'Saving…' : 'Save Goal'}
              </button>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}
