import React, { useState, useEffect, useRef } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Plus, X, Search, Loader, AlertCircle, Check } from 'lucide-react'
import { useBookMutations } from '../../hooks/useBookMutations'
import { useBooksQuery } from '../../hooks/useBooksQuery'
import { SheetSelect } from '../SheetSelect'

type BookStatus = 'reading' | 'to-read' | 'finished' | 'abandoned'

interface OLBook {
  title: string
  author: string
  pages?: number
  coverId?: number
  coverUrl?: string
  isbn?: string
  language?: string
  genre?: string
  subjects?: string[]
}

async function searchOpenLibrary(query: string): Promise<OLBook[]> {
  if (!query.trim()) return []
  const res = await fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=5&fields=title,author_name,number_of_pages_median,cover_i,isbn,language,subject`)
  const json = await res.json()
  return (json.docs ?? []).map((d: Record<string, any>) => ({
    title: d.title as string,
    author: Array.isArray(d.author_name) ? (d.author_name as string[])[0] : '',
    pages: d.number_of_pages_median as number | undefined,
    coverId: d.cover_i as number | undefined,
    coverUrl: d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg` : undefined,
    isbn: Array.isArray(d.isbn) ? d.isbn[0] : undefined,
    language: Array.isArray(d.language) ? d.language[0] : undefined,
    genre: Array.isArray(d.subject) ? d.subject[0] : undefined,
    subjects: Array.isArray(d.subject) ? (d.subject as string[]).slice(0, 20) : [],
  }))
}

// ── Genre → Shelf mapping ──────────────────────────────────────────────
const SHELF_MAP: Array<{ keywords: string[]; shelf: string }> = [
  { keywords: ['science fiction', 'sci-fi', 'dystopia', 'space opera', 'cyberpunk', 'hard science fiction'], shelf: 'Sci-Fi' },
  { keywords: ['fantasy', 'epic fantasy', 'dark fantasy', 'sword', 'sorcery', 'magic'], shelf: 'Fantasy' },
  { keywords: ['romance', 'love stories', 'romantic fiction', 'contemporary romance'], shelf: 'Romance' },
  { keywords: ['mystery', 'detective', 'crime fiction', 'thriller', 'suspense', 'whodunit'], shelf: 'Mystery & Thriller' },
  { keywords: ['biography', 'autobiography', 'memoir', 'personal memoirs'], shelf: 'Biography & Memoir' },
  { keywords: ['history', 'historical', 'world war', 'ancient', 'civilization'], shelf: 'History' },
  { keywords: ['self-help', 'self help', 'personal development', 'motivation', 'productivity', 'leadership'], shelf: 'Self-Help' },
  { keywords: ['philosophy', 'ethics', 'stoicism', 'existentialism'], shelf: 'Philosophy' },
  { keywords: ['psychology', 'cognitive', 'behavioral', 'neuroscience', 'psychiatry'], shelf: 'Psychology' },
  { keywords: ['horror', 'ghost stories', 'supernatural fiction', 'occult'], shelf: 'Horror' },
  { keywords: ['graphic novel', 'comics', 'manga'], shelf: 'Comics & Manga' },
  { keywords: ['economics', 'finance', 'business', 'entrepreneurship', 'investing'], shelf: 'Business & Finance' },
  { keywords: ['science', 'popular science', 'physics', 'biology', 'chemistry', 'mathematics'], shelf: 'Science & Nature' },
  { keywords: ['travel', 'adventure', 'exploration'], shelf: 'Travel & Adventure' },
  { keywords: ['poetry', 'poems', 'verse'], shelf: 'Poetry' },
  { keywords: ['children', "children's fiction", 'juvenile fiction', 'young adult', 'ya fiction'], shelf: 'Young Adult & Children' },
  { keywords: ['classics', 'classic literature', 'literary fiction', 'fiction'], shelf: 'Classics & Literary' },
]

function inferShelves(subjects: string[]): string[] {
  const lower = subjects.map(s => s.toLowerCase())
  const matched: string[] = []
  for (const { keywords, shelf } of SHELF_MAP) {
    if (keywords.some(kw => lower.some(s => s.includes(kw)))) {
      matched.push(shelf)
      if (matched.length === 2) break // max 2 auto-shelves
    }
  }
  return matched
}

export function AddBookModal({
  defaultStatus = 'to-read',
  open: openProp,
  onOpenChange,
  prefillTitle,
  prefillAuthor,
  prefillCoverUrl,
}: {
  defaultStatus?: BookStatus
  open?: boolean
  onOpenChange?: (open: boolean) => void
  prefillTitle?: string
  prefillAuthor?: string
  prefillCoverUrl?: string
}) {
  const [openState, setOpenState] = useState(false)
  const isControlled = openProp !== undefined
  const open = isControlled ? openProp : openState
  const setOpen = (v: boolean) => {
    if (isControlled) onOpenChange?.(v)
    else setOpenState(v)
  }
  const [title, setTitle] = useState(prefillTitle || '')
  const [author, setAuthor] = useState(prefillAuthor || '')
  const [pages, setPages] = useState('')
  const [status, setStatus] = useState<BookStatus>(defaultStatus)
  const [coverUrl, setCoverUrl] = useState<string | undefined>(prefillCoverUrl)
  const [duplicateError, setDuplicateError] = useState(false)
  const [justAdded, setJustAdded] = useState(false)

  useEffect(() => {
    if (open) {
      if (prefillTitle !== undefined) setTitle(prefillTitle)
      if (prefillAuthor !== undefined) setAuthor(prefillAuthor)
      if (prefillCoverUrl !== undefined) setCoverUrl(prefillCoverUrl)
    }
  }, [open, prefillTitle, prefillAuthor, prefillCoverUrl])

  const [genre, setGenre] = useState('')
  const [isbn, setIsbn] = useState('')
  const [language, setLanguage] = useState('')
  const [source, setSource] = useState<'physical' | 'ebook' | 'audiobook' | 'library' | ''>('')
  const [shelves, setShelves] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)

  const [searchQ, setSearchQ] = useState('')
  const [searching, setSearching] = useState(false)
  const [suggestions, setSuggestions] = useState<OLBook[]>([])
  const searchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const { addBook } = useBookMutations()
  const { data: allBooks = [] } = useBooksQuery()

  // Debounced Open Library search
  useEffect(() => {
    if (!searchQ.trim() || searchQ.length < 3) { setSuggestions([]); return }
    clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(async () => {
      setSearching(true)
      try {
        const results = await searchOpenLibrary(searchQ)
        setSuggestions(results)
      } catch { setSuggestions([]) }
      finally { setSearching(false) }
    }, 500)
    return () => clearTimeout(searchTimer.current)
  }, [searchQ])

  const pickSuggestion = (book: OLBook) => {
    setTitle(book.title)
    setAuthor(book.author)
    if (book.pages) setPages(book.pages.toString())
    setCoverUrl(book.coverUrl)
    if (book.isbn) setIsbn(book.isbn)
    if (book.language) setLanguage(book.language)
    if (book.genre) setGenre(book.genre)
    // Auto-suggest shelves from subject list
    if (book.subjects && book.subjects.length > 0) {
      const inferred = inferShelves(book.subjects)
      if (inferred.length > 0) setShelves(inferred.join(', '))
    }
    setSuggestions([])
    setSearchQ('')
    setDuplicateError(false)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const titleTrimmed = title.trim()
    if (!titleTrimmed) return
    if (allBooks.some(b => b.title.toLowerCase() === titleTrimmed.toLowerCase())) {
      setDuplicateError(true)
      return
    }
    setDuplicateError(false)
    addBook.mutate({
      title: titleTrimmed,
      author: author.trim() || undefined,
      total_pages: pages ? parseInt(pages) : undefined,
      status,
      cover_url: coverUrl,
      genre: genre.trim() || undefined,
      isbn: isbn.trim() || undefined,
      language: language.trim() || undefined,
      source: source || undefined,
      shelves: shelves ? shelves.split(',').map(s => s.trim()).filter(Boolean) : undefined,
    }, {
      onSuccess: () => {
        setTitle(''); setAuthor(''); setPages(''); setCoverUrl(undefined); setSearchQ('')
        setGenre(''); setIsbn(''); setLanguage(''); setSource(''); setShelves('')
        setShowAdvanced(false)
        setJustAdded(true)
        setTimeout(() => {
          setJustAdded(false)
          setOpen(false)
        }, 700)
      }
    })
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      {!isControlled && (
        <Dialog.Trigger asChild>
          <button className="w-full flex items-center justify-center gap-2 py-3 bg-surface-2 border border-dashed border-border rounded-xl text-text-secondary hover:text-text hover:border-text-muted transition-colors text-sm font-medium">
            <Plus size={18} /> Add Book
          </button>
        </Dialog.Trigger>
      )}
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-bg/80 backdrop-blur-sm" />
        <Dialog.Content className="fixed bottom-0 left-0 right-0 z-50 bg-surface border-t border-border rounded-t-2xl p-5 shadow-2xl sm:inset-auto sm:left-1/2 sm:-translate-x-1/2 sm:top-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-md sm:rounded-2xl sm:border max-h-[90vh] overflow-y-auto"
          style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}>
          <div className="w-10 h-1 rounded-full bg-border mx-auto mb-4 sm:hidden" />
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-base font-medium text-text">Add to Library</Dialog.Title>
            <Dialog.Close className="text-text-muted hover:text-text"><X size={18} /></Dialog.Close>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Open Library search */}
            <div className="relative">
              <label className="block text-xs text-text-muted mb-2 uppercase tracking-wider">Search Open Library</label>
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                <input value={searchQ} onChange={e => setSearchQ(e.target.value)}
                  placeholder="Search by title or author…"
                  className="selectable w-full bg-surface-2 border border-border rounded-xl pl-9 pr-4 py-2 text-sm text-text focus:border-accent focus:outline-none" />
                {searching && <Loader size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted animate-spin" />}
              </div>

              {suggestions.length > 0 && (
                <div className="absolute z-10 left-0 right-0 mt-1 bg-surface border border-border rounded-xl shadow-xl overflow-hidden max-h-64 overflow-y-auto">
                  {suggestions.map((s, i) => (
                    <button key={i} type="button" onClick={() => pickSuggestion(s)}
                      className="w-full flex items-center gap-3 px-3 py-2 hover:bg-surface-2 transition-colors text-left border-b border-border last:border-0">
                      {s.coverUrl
                        ? <img src={s.coverUrl} alt="" className="w-8 h-12 object-cover rounded flex-shrink-0" onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                        : <div className="w-8 h-12 bg-surface-2 rounded flex-shrink-0 flex items-center justify-center text-text-muted text-lg">📘</div>
                      }
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-text truncate">{s.title}</p>
                        <p className="text-xs text-text-muted truncate">{s.author}</p>
                        {s.pages && <p className="text-[10px] text-text-muted">{s.pages} pages</p>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-4 items-start">
              {/* Cover preview */}
              {coverUrl && (
                <div className="relative flex-shrink-0">
                  <img src={coverUrl} alt="cover" className="w-14 h-20 object-cover rounded-lg border border-border shadow-md" />
                  <button type="button" onClick={() => setCoverUrl(undefined)}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-danger rounded-full flex items-center justify-center">
                    <X size={10} className="text-bg" />
                  </button>
                </div>
              )}

              <div className="flex-1 space-y-3">
                <div>
                  <label className="block text-xs text-text-muted mb-1 uppercase tracking-wider">Title</label>
                  <input required value={title} onChange={e => { setTitle(e.target.value); setDuplicateError(false) }} placeholder="Book title"
                    className="selectable w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-sm text-text focus:border-accent focus:outline-none" />
                  {duplicateError && (
                    <p className="flex items-center gap-2 text-xs text-danger mt-2">
                      <AlertCircle size={12} /> This book is already in your library.
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-xs text-text-muted mb-1 uppercase tracking-wider">Author</label>
                  <input value={author} onChange={e => setAuthor(e.target.value)} placeholder="Optional"
                    className="selectable w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-sm text-text focus:border-accent focus:outline-none" />
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-xs text-text-muted mb-2 uppercase tracking-wider">Pages</label>
                <input type="number" min="1" value={pages} onChange={e => setPages(e.target.value)} placeholder="Optional"
                  className="selectable w-full bg-surface-2 border border-border rounded-xl px-4 py-2 text-text focus:border-accent focus:outline-none" />
              </div>
              <div className="flex-[2]">
                <label className="block text-xs text-text-muted mb-2 uppercase tracking-wider">Status</label>
                <SheetSelect
                  label="Status"
                  value={status}
                  onChange={(v) => setStatus(v as BookStatus)}
                  options={[{ value: 'to-read', label: 'To Read' }, { value: 'reading', label: 'Reading' }]}
                />
              </div>
            </div>

            {/* Advanced Toggle */}
            <div className="pt-1">
              <button type="button" onClick={() => setShowAdvanced(!showAdvanced)}
                className="text-xs font-semibold text-accent hover:underline focus:outline-none">
                {showAdvanced ? 'Hide Advanced Options' : 'Show Advanced Options (Genre, ISBN, shelves…)'}
              </button>
            </div>

            {showAdvanced && (
              <div className="space-y-3 border-t border-border/60 pt-3 animate-in fade-in duration-200">
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="block text-xs text-text-muted mb-1 uppercase tracking-wider">Genre</label>
                    <input value={genre} onChange={e => setGenre(e.target.value)} placeholder="e.g. Fiction"
                      className="selectable w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-sm text-text focus:border-accent focus:outline-none" />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs text-text-muted mb-2 uppercase tracking-wider">Source</label>
                    <SheetSelect
                      label="Source"
                      value={source}
                      onChange={(v) => setSource(v as typeof source)}
                      placeholder="Select source"
                      options={[
                        { value: '', label: 'Select source' },
                        { value: 'physical', label: 'Physical' },
                        { value: 'ebook', label: 'E-Book' },
                        { value: 'audiobook', label: 'Audiobook' },
                        { value: 'library', label: 'Library' },
                      ]}
                    />
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="block text-xs text-text-muted mb-1 uppercase tracking-wider">ISBN</label>
                    <input value={isbn} onChange={e => setIsbn(e.target.value)} placeholder="Optional"
                      className="selectable w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-sm text-text focus:border-accent focus:outline-none" />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs text-text-muted mb-1 uppercase tracking-wider">Language</label>
                    <input value={language} onChange={e => setLanguage(e.target.value)} placeholder="e.g. English"
                      className="selectable w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-sm text-text focus:border-accent focus:outline-none" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-text-muted mb-1 uppercase tracking-wider">Shelves / Collections</label>
                  <input value={shelves} onChange={e => setShelves(e.target.value)} placeholder="e.g. Sci-Fi, Classics, Favorites"
                    className="selectable w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-sm text-text focus:border-accent focus:outline-none" />
                  <p className="text-[10px] text-text-muted mt-1">Separate shelf names with commas</p>
                </div>
              </div>
            )}

            <button type="submit" disabled={!title.trim() || addBook.isPending || justAdded}
              className={`w-full font-medium rounded-xl py-3 transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 ${justAdded ? 'bg-success text-bg' : 'bg-accent text-bg hover:bg-accent-dim'}`}>
              {justAdded && <Check size={16} />}
              {justAdded ? 'Added!' : addBook.isPending ? 'Saving…' : 'Add Book'}
            </button>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
