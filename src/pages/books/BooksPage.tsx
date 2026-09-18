import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import * as Dialog from '@radix-ui/react-dialog'
import { BookOpen, Search, X, SlidersHorizontal, Award, Star, Clock3, CheckCircle2, XCircle, BarChart3 } from 'lucide-react'
import { useBooksQuery } from '../../hooks/useBooksQuery'
import { useBookMutations } from '../../hooks/useBookMutations'
import { BookItem } from '../../components/books/BookItem'
import { AddBookModal } from '../../components/books/AddBookModal'
import { EmptyState } from '../../components/EmptyState'
import { ExportButton } from '../../components/ExportButton'
import { PageSkeleton } from '../../components/Skeleton'
import { useReadingGoalsQuery, useSaveReadingGoalMutation } from '../../hooks/useReadingGoalsQuery'
import { haptic } from '../../lib/haptic'
import { useContextualAdd } from '../../hooks/useContextualAdd'
import { SheetSelect } from '../../components/SheetSelect'
import clsx from 'clsx'

type TabStatus = 'reading' | 'to-read' | 'finished' | 'abandoned' | 'stats'

const TABS: { value: TabStatus; label: string; icon: typeof BookOpen }[] = [
  { value: 'reading',   label: 'Reading',   icon: BookOpen     },
  { value: 'to-read',   label: 'To Read',   icon: Clock3       },
  { value: 'finished',  label: 'Finished',  icon: CheckCircle2 },
  { value: 'abandoned', label: 'Abandoned', icon: XCircle      },
  { value: 'stats',     label: 'Stats',     icon: BarChart3    },
]

const EMPTY_MESSAGES: Record<Exclude<TabStatus, 'stats'>, string> = {
  'reading':   'No books in progress. Start one!',
  'to-read':   'Your reading list is empty.',
  'finished':  'No finished books yet.',
  'abandoned': 'Nothing abandoned — nice.',
}

export function BooksPage() {
  const [tab, setTab] = useState<TabStatus>('reading')
  const navigate = useNavigate()
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
  const [addOpen, setAddOpen] = useState(false)

  // Opens only when contextual add is tapped
  useContextualAdd(() => {
    if (tab === 'stats') setTab('to-read')
    setAddOpen(true)
  })

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

    // ── Reading speed & time stats ─────────────────────────────────────
    type FinishedWithDays = { id: string; title: string; total_pages: number; days: number }
    const finishedWithDays: FinishedWithDays[] = allBooks
      .filter(b => b.status === 'finished' && b.total_pages && b.started_at && b.finished_at)
      .map(b => {
        const start = new Date(b.started_at!).getTime()
        const end   = new Date(b.finished_at!).getTime()
        const days  = Math.max(1, Math.round((end - start) / 86_400_000))
        return { id: b.id, title: b.title, total_pages: b.total_pages!, days }
      })

    const totalDays  = finishedWithDays.reduce((s, b) => s + b.days, 0)
    const totalPages = finishedWithDays.reduce((s, b) => s + b.total_pages, 0)

    // Avg pages per day across all finished books that have date data
    const avgPagesPerDay = finishedWithDays.length > 0 && totalDays > 0
      ? Math.round(totalPages / totalDays)
      : null

    // Average days to finish a book
    const avgDaysPerBook = finishedWithDays.length > 0
      ? Math.round(totalDays / finishedWithDays.length)
      : null

    // Longest book read (most pages among finished)
    const longestBook = allBooks
      .filter(b => b.status === 'finished' && b.total_pages)
      .reduce<{ title: string; total_pages: number } | null>((best, b) =>
        !best || (b.total_pages || 0) > best.total_pages ? { title: b.title, total_pages: b.total_pages! } : best
      , null)

    // Fastest finish (fewest days for a book with date data)
    const fastestBook = finishedWithDays.length > 0
      ? finishedWithDays.reduce((best, b) => b.days < best.days ? b : best)
      : null

    return { byStatus, totalPagesFinished, avgRating, currentlyReading, avgPagesPerDay, avgDaysPerBook, longestBook, fastestBook }
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
          <h1 className="font-display text-2xl font-bold text-text">
            Library
          </h1>
          <p className="text-xs text-text-secondary mt-0.5">
            {allBooks.length} book{allBooks.length !== 1 ? 's' : ''} total
          </p>
        </div>

        <div className="flex items-center gap-2">
        {targetBooks > 0 ? (
          <button
            onClick={() => { haptic('light'); setShowGoalModal(true) }}
            className="flex items-center gap-3 bg-surface border border-border px-4 py-2 rounded-xl hover:border-accent transition-all hover:shadow-sm"
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
            className="text-xs font-medium text-accent border border-accent/25 bg-accent/5 hover:bg-accent/10 hover:border-accent/40 transition-colors px-3 py-2 rounded-xl flex items-center gap-2"
          >
            <Award size={14} /> Set Reading Goal
          </button>
        )}
        <ExportButton table="books" label="Books" />
        </div>
      </header>

      {/* ── Tab switcher — icon + label on wide screens, icon-only on narrow (matches Finance's tab bar pattern) so all 5 fit without needing to scroll ── */}
      <div className="grid grid-cols-5 gap-1 p-1 bg-surface-2 border border-border rounded-2xl">
        {TABS.map(tb => {
          const Icon = tb.icon
          const isActive = tab === tb.value
          const count = tb.value !== 'stats' ? allBooks.filter(b => b.status === tb.value).length : 0
          return (
            <button
              key={tb.value}
              onClick={() => { haptic('light'); setTab(tb.value) }}
              className={clsx(
                'flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 py-2 px-1 rounded-xl transition-all duration-200 font-medium w-full',
                isActive ? 'bg-surface text-text shadow-sm' : 'text-text-muted hover:text-text-secondary'
              )}
            >
              <Icon size={15} strokeWidth={isActive ? 2.5 : 1.75} />
              <span className="text-[9px] sm:text-xs font-semibold whitespace-nowrap">
                {tb.label}
                {tb.value !== 'stats' && count > 0 && (
                  <span className="ml-1 opacity-60 hidden sm:inline">{count}</span>
                )}
              </span>
            </button>
          )
        })}
      </div>

      {/* ── Book list panels ─────────────────────────────────────────────── */}
      {tab !== 'stats' && (
        <>
          <AddBookModal defaultStatus={tab === 'finished' || tab === 'abandoned' ? 'to-read' : tab} open={addOpen} onOpenChange={setAddOpen} />

          {/* Sort & Filter */}
          <div className="bg-surface border border-border p-4 rounded-2xl space-y-3 shadow-[var(--shadow-card)]">
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
                  'flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-xl border transition-colors',
                  showFilters ? 'border-accent bg-accent/10 text-accent' : 'border-border bg-surface-2 text-text-secondary hover:text-text'
                )}
              >
                <SlidersHorizontal size={13} /> Filters
              </button>
              <SheetSelect
                label="Sort by"
                value={sortBy}
                onChange={(v) => setSortBy(v as typeof sortBy)}
                options={[
                  { value: 'added', label: '🕒 Added' },
                  { value: 'rating', label: '⭐️ Rating' },
                  { value: 'pages', label: '📖 Pages' },
                  { value: 'title', label: '🔤 Title' },
                ]}
                className="!w-auto text-xs font-semibold"
              />
            </div>

            {showFilters && (
              <div className="flex flex-wrap gap-2 text-xs pt-1 border-t border-border/40 mt-2 animate-in fade-in duration-200">
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] uppercase tracking-wider text-text-muted font-bold pl-1">Genre</label>
                  <SheetSelect
                    label="Genre"
                    value={filterGenre}
                    onChange={setFilterGenre}
                    options={[{ value: 'all', label: 'All Genres' }, ...genres.map(g => ({ value: g, label: g }))]}
                    className="!w-auto !py-1 !px-2 text-text-secondary"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] uppercase tracking-wider text-text-muted font-bold pl-1">Source</label>
                  <SheetSelect
                    label="Source"
                    value={filterSource}
                    onChange={setFilterSource}
                    options={[
                      { value: 'all', label: 'All Sources' },
                      { value: 'physical', label: 'Physical' },
                      { value: 'ebook', label: 'E-Book' },
                      { value: 'audiobook', label: 'Audiobook' },
                      { value: 'library', label: 'Library' },
                    ]}
                    className="!w-auto !py-1 !px-2 text-text-secondary"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] uppercase tracking-wider text-text-muted font-bold pl-1">Shelf</label>
                  <SheetSelect
                    label="Shelf"
                    value={filterShelf}
                    onChange={setFilterShelf}
                    options={[{ value: 'all', label: 'All Shelves' }, ...shelves.map(s => ({ value: s, label: s }))]}
                    className="!w-auto !py-1 !px-2 text-text-secondary"
                  />
                </div>
                {tab === 'finished' && yearsFinished.length > 0 && (
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] uppercase tracking-wider text-text-muted font-bold pl-1">Year</label>
                    <SheetSelect
                      label="Year"
                      value={filterYear}
                      onChange={setFilterYear}
                      options={[{ value: 'all', label: 'All Years' }, ...yearsFinished.map(y => ({ value: y, label: y }))]}
                      className="!w-auto !py-1 !px-2 text-text-secondary"
                    />
                  </div>
                )}
                <button
                  onClick={() => { setFilterGenre('all'); setFilterSource('all'); setFilterShelf('all'); setFilterYear('all'); setSearchQuery('') }}
                  className="self-end px-3 py-2 text-text-muted hover:text-text font-medium underline text-[11px]"
                >
                  Reset All
                </button>
              </div>
            )}
          </div>

          <div className="mt-4">
            {isLoading ? (
              <PageSkeleton />
            ) : processedBooks.length === 0 ? (
              <EmptyState
                icon={<BookOpen size={40} />}
                title="No books matched"
                message={EMPTY_MESSAGES[tab as Exclude<TabStatus, 'stats'>]}
              />
            ) : (
              <div>
                {tab === 'reading' && processedBooks.length > 0 && (
                  <BookItem
                    key={processedBooks[0].id}
                    book={processedBooks[0] as any}
                    onDelete={id => deleteBook.mutate(id)}
                    layoutMode="hero"
                  />
                )}
                
                {(tab !== 'reading' || processedBooks.length > 1) && (
                  <>
                    {tab === 'reading' && (
                      <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-3 pl-1 mt-4">
                        Other Books In Progress
                      </h3>
                    )}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                      {processedBooks
                        .slice(tab === 'reading' ? 1 : 0)
                        .map(b => (
                          <BookItem
                            key={b.id}
                            book={b as any}
                            onDelete={id => deleteBook.mutate(id)}
                          />
                        ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Stats panel ──────────────────────────────────────────────────── */}
      {tab === 'stats' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          
          {/* Hero Row: Goal Ring & Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Hero Progress Ring Card */}
            <div className="md:col-span-2 bg-surface border border-border rounded-3xl p-6 shadow-[var(--shadow-card)] flex flex-col sm:flex-row items-center justify-between gap-6">
              <div className="flex-1 space-y-3">
                <span className="text-[10px] bg-success/10 text-success border border-success/20 px-3 py-0.5 rounded-full font-bold uppercase tracking-wider">
                  Annual Reading Goal
                </span>
                <h3 className="text-xl font-display font-bold text-text">
                  {currentYear} Reading Journey
                </h3>
                <p className="text-sm text-text-secondary">
                  You have completed <strong className="text-text font-bold">{completedThisYear}</strong> out of <strong className="text-text font-bold">{targetBooks || 1}</strong> books set for this year's goal.
                </p>
                {targetBooks > 0 ? (
                  <button
                    onClick={() => { haptic('light'); setShowGoalModal(true) }}
                    className="text-xs font-semibold text-accent hover:underline flex items-center gap-1"
                  >
                    Adjust reading goal
                  </button>
                ) : (
                  <button
                    onClick={() => { haptic('light'); setShowGoalModal(true) }}
                    className="text-xs font-semibold text-accent hover:underline flex items-center gap-1"
                  >
                    Set a reading goal
                  </button>
                )}
              </div>

              {/* Large Progress Ring */}
              <div className="relative w-36 h-36 flex-shrink-0 flex items-center justify-center">
                <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                  <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" className="text-surface-2" strokeWidth="6" />
                  <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor"
                    className="text-success"
                    strokeWidth="6"
                    strokeDasharray={`${(pct / 100) * 263.89} 263.89`}
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dasharray 600ms ease' }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-display font-extrabold text-text">{pct}%</span>
                  <span className="text-[9px] text-text-muted uppercase tracking-wider font-semibold">Done</span>
                </div>
              </div>
            </div>

            {/* Quick stats panel beside ring */}
            <div className="bg-surface border border-border rounded-3xl p-6 shadow-[var(--shadow-card)] flex flex-col justify-between gap-4">
              <div>
                <p className="text-[10px] text-text-muted uppercase tracking-wider font-bold">Total Pages Read</p>
                <p className="text-4xl font-display text-accent font-bold mt-2">
                  {stats.totalPagesFinished.toLocaleString()}
                </p>
                <p className="text-[10px] text-text-secondary mt-1">across finished books</p>
              </div>
              <div className="border-t border-border/40 pt-4 flex items-center justify-between">
                <div>
                  <p className="text-[9px] text-text-muted uppercase tracking-wider font-semibold">Library Size</p>
                  <p className="text-lg font-display text-text font-bold">{allBooks.length}</p>
                </div>
                <div>
                  <p className="text-[9px] text-text-muted uppercase tracking-wider font-semibold">Avg Rating</p>
                  {stats.avgRating ? (
                    <div className="flex items-center gap-1">
                      <span className="text-lg font-display text-warning font-bold">{stats.avgRating.toFixed(1)}</span>
                      <Star size={12} className="fill-warning text-warning" />
                    </div>
                  ) : (
                    <span className="text-sm font-semibold text-text-muted">—</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Library breakdown — one neutral card, not four competing colors.
              Apple Health reserves color for the one thing that matters (the
              ring above); everything else here is quiet by comparison. */}
          <div className="bg-surface border border-border rounded-2xl p-5 shadow-[var(--shadow-card)]">
            <div className="grid grid-cols-4 divide-x divide-border/60">
              {([
                { label: 'Reading',   count: stats.byStatus.reading },
                { label: 'To Read',   count: stats.byStatus['to-read'] },
                { label: 'Finished',  count: stats.byStatus.finished },
                { label: 'Abandoned', count: stats.byStatus.abandoned },
              ] as const).map(({ label, count }) => (
                <div key={label} className="text-center px-1">
                  <p className="text-2xl font-display font-bold text-text">{count}</p>
                  <p className="text-[10px] text-text-muted uppercase tracking-wider font-semibold mt-1">{label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Reading Speed & Time Stats — same treatment: one card, a list of
              label/value rows, instead of four separate colored boxes. */}
          {(stats.avgPagesPerDay || stats.avgDaysPerBook || stats.longestBook || stats.fastestBook) && (
            <div className="bg-surface border border-border rounded-2xl p-5 shadow-[var(--shadow-card)] divide-y divide-border/50">
              {stats.avgPagesPerDay !== null && (
                <div className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
                  <span className="text-xs text-text-secondary">Reading speed</span>
                  <span className="text-sm font-semibold text-text">{stats.avgPagesPerDay} pages/day</span>
                </div>
              )}
              {stats.avgDaysPerBook !== null && (
                <div className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
                  <span className="text-xs text-text-secondary">Avg. finish time</span>
                  <span className="text-sm font-semibold text-text">{stats.avgDaysPerBook} days/book</span>
                </div>
              )}
              {stats.longestBook && (
                <div className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0 gap-3">
                  <span className="text-xs text-text-secondary flex-shrink-0">Longest read</span>
                  <span className="text-sm font-semibold text-text truncate text-right" title={stats.longestBook.title}>
                    {stats.longestBook.title} <span className="text-text-muted font-normal">· {stats.longestBook.total_pages.toLocaleString()}p</span>
                  </span>
                </div>
              )}
              {stats.fastestBook && (
                <div className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0 gap-3">
                  <span className="text-xs text-text-secondary flex-shrink-0">Fastest finish</span>
                  <span className="text-sm font-semibold text-text truncate text-right" title={stats.fastestBook.title}>
                    {stats.fastestBook.title} <span className="text-text-muted font-normal">· {stats.fastestBook.days}d</span>
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Currently reading progress */}
          {stats.currentlyReading.length > 0 && (
            <div className="bg-surface border border-border p-5 rounded-3xl shadow-[var(--shadow-card)]">
              <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted mb-4">
                In Progress
              </h3>
              <div className="space-y-4">
                {stats.currentlyReading.map(b => (
                  <div key={b.id}>
                    <div className="flex justify-between items-baseline mb-2">
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

          {/* Completed Bookshelf Visual Grid */}
          {(() => {
            const finishedBooks = allBooks.filter(b => b.status === 'finished')
            const size = 4
            const shelfChunks = Array.from({ length: Math.ceil(finishedBooks.length / size) }, (_, i) =>
              finishedBooks.slice(i * size, i * size + size)
            )

            if (finishedBooks.length === 0) return null

            return (
              <div className="space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted pl-1">
                  Completed Bookshelf
                </h3>
                <div className="space-y-8 bg-surface-2/45 p-6 rounded-3xl border border-border/80">
                  {shelfChunks.map((shelf, shelfIdx) => (
                    <div key={shelfIdx} className="relative pb-4">
                      <div className="grid grid-cols-4 gap-4 justify-items-center relative z-10 px-2">
                        {shelf.map(book => (
                          <div key={book.id} className="w-full max-w-[80px] sm:max-w-[100px] flex flex-col items-center">
                            <div
                              onClick={() => navigate(`/books/${book.id}`)}
                              className="w-full aspect-[3/4] rounded-md shadow-md border border-border/60 overflow-hidden hover:-translate-y-1 hover:shadow-lg transition-all duration-300 bg-surface cursor-pointer"
                            >
                              {book.cover_url ? (
                                <img src={book.cover_url} alt={book.title} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-2xl font-bold bg-surface-2 opacity-50">📘</div>
                              )}
                            </div>
                            <span className="text-[10px] text-text-secondary mt-2 font-medium truncate w-full text-center">
                              {book.title}
                            </span>
                          </div>
                        ))}
                        {Array.from({ length: 4 - shelf.length }).map((_, i) => (
                          <div key={i} className="w-full max-w-[80px] sm:max-w-[100px]" />
                        ))}
                      </div>
                      <div className="absolute bottom-3 left-0 right-0 h-2 bg-gradient-to-r from-amber-800 to-amber-950 rounded-full shadow-sm opacity-80" />
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}

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
                <label className="block text-xs text-text-muted mb-2 uppercase tracking-wider">Target Books</label>
                <input required type="number" min="1"
                  value={goalBooks} onChange={e => setGoalBooks(e.target.value)}
                  placeholder="e.g. 24"
                  className="selectable w-full bg-surface-2 border border-border rounded-xl px-4 py-3 text-text focus:border-accent focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-2 uppercase tracking-wider">Target Pages (Optional)</label>
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
