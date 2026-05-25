
import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, ChevronRight, FileText, CheckSquare, Inbox, BookOpen, XCircle } from 'lucide-react'
import { useGlobalSearch, type SearchResult } from '../../hooks/useGlobalSearch'
import { useAppStore } from '../../store/useAppStore'
import clsx from 'clsx'

const TYPE_ICONS: Record<SearchResult['type'], React.ElementType> = {
  task: CheckSquare,
  note: FileText,
  inbox: Inbox,
  book: BookOpen
}

const TYPE_COLORS: Record<SearchResult['type'], string> = {
  task: 'text-success bg-success/10 border-success/20',
  note: 'text-accent bg-accent/10 border-accent/20',
  inbox: 'text-warning bg-warning/10 border-warning/20',
  book: 'text-info bg-info/10 border-info/20'
}

export function SearchPage() {
  const [query, setQuery] = useState('')
  const { results, loading } = useGlobalSearch(query)
  const inputRef = useRef<HTMLInputElement>(null)
  
  const navigate = useNavigate()
  const setDate = useAppStore(state => state.setDate)

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleResultClick = (result: SearchResult) => {
    // If the item belongs to a specific date, travel to that date before navigating
    if (result.date) {
      setDate(result.date)
    }
    navigate(result.path)
  }

  return (
    <div className="space-y-6">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" size={20} />
        <input
          ref={inputRef}
          type="text"
          placeholder="Search tasks, notes, books..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="w-full bg-surface-2 border border-border rounded-2xl pl-12 pr-12 py-4 text-lg text-text placeholder-text-muted focus:border-accent focus:outline-none transition-colors shadow-sm"
        />
        {query && (
          <button onClick={() => setQuery('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted hover:text-text">
            <XCircle size={20} />
          </button>
        )}
      </div>

      <div className="space-y-3">
        {loading && query.length >= 2 && (
          <div className="text-center py-8">
            <div className="w-6 h-6 border-2 border-accent/30 border-t-accent rounded-full animate-spin mx-auto" />
          </div>
        )}

        {!loading && query.length >= 2 && results.length === 0 && (
          <div className="text-center py-16 text-text-muted">
            <Search size={32} className="mx-auto mb-3 opacity-50" />
            <p>No results found for "{query}"</p>
          </div>
        )}

        {!loading && results.map(result => {
          const Icon = TYPE_ICONS[result.type]
          return (
            <button
              key={`${result.type}-${result.id}`}
              onClick={() => handleResultClick(result)}
              className="w-full flex items-center justify-between p-4 bg-surface border border-border rounded-xl hover:bg-surface-2 transition-colors text-left group"
            >
              <div className="flex items-center gap-4 min-w-0">
                <div className={clsx("w-10 h-10 rounded-full flex items-center justify-center border flex-shrink-0", TYPE_COLORS[result.type])}>
                  <Icon size={18} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-text truncate pr-4">{result.title}</p>
                  <p className="text-xs text-text-muted truncate">{result.subtitle}</p>
                </div>
              </div>
              <ChevronRight size={18} className="text-text-muted group-hover:text-text transition-colors flex-shrink-0" />
            </button>
          )
        })}

        {!query && (
          <div className="text-center py-16 text-text-muted/50">
            <p className="text-sm">Type at least 2 characters to search</p>
          </div>
        )}
      </div>
    </div>
  )
}
