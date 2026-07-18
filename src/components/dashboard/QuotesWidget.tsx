import { useState } from 'react'
import { Quote, ChevronRight, ChevronLeft } from 'lucide-react'
import { useQuotesQuery } from '../../hooks/useQuotesQuery'
import { useAppStore } from '../../store/useAppStore'

export function QuotesWidget() {
  const { data: quotes = [] } = useQuotesQuery()
  const { quoteIntervalHours } = useAppStore()

  // Deterministic base index — changes every N hours automatically
  const baseIndex = quotes.length > 0
    ? Math.floor(Date.now() / (quoteIntervalHours * 3_600_000)) % quotes.length
    : 0

  // Manual offset on top of the time-based index
  const [offset, setOffset] = useState(0)
  const currentIndex = quotes.length > 0
    ? ((baseIndex + offset) % quotes.length + quotes.length) % quotes.length
    : 0
  const quote = quotes[currentIndex]

  if (quotes.length === 0) {
    return (
      <div className="bg-surface border border-border rounded-2xl p-4 space-y-2">
        <p className="text-xs text-text-muted uppercase tracking-widest flex items-center gap-2">
          <Quote size={11} /> Quote
        </p>
        <p className="text-sm text-text-muted italic leading-relaxed">
          No quotes saved yet — tap the speech bubble on any book to save a passage.
        </p>
      </div>
    )
  }

  return (
    <div className="bg-surface border border-border rounded-2xl p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-text-muted uppercase tracking-widest flex items-center gap-2">
          <Quote size={11} /> Quote
        </p>
        <span className="text-[10px] text-text-muted bg-surface-2 px-2 py-0.5 rounded-full">
          every {quoteIntervalHours}h
        </span>
      </div>

      {/* Quote */}
      <blockquote className="text-sm text-text leading-relaxed italic mb-3">
        "{quote.text}"
      </blockquote>

      {/* Attribution */}
      {(quote.book_title || quote.book_author) && (
        <p className="text-xs text-text-muted mb-4">
          — {quote.book_author ? `${quote.book_author}` : ''}{quote.book_author && quote.book_title ? ', ' : ''}{quote.book_title ? <em>{quote.book_title}</em> : ''}
          {quote.page ? ` · p. ${quote.page}` : ''}
        </p>
      )}

      {/* Navigation */}
      {quotes.length > 1 && (
        <div className="flex items-center justify-between pt-3 border-t border-border/50">
          <button
            onClick={() => setOffset(o => o - 1)}
            className="p-1 text-text-muted hover:text-accent transition-colors rounded-lg hover:bg-accent/10"
            title="Previous quote"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="text-[10px] text-text-muted">
            {currentIndex + 1} / {quotes.length}
          </span>
          <button
            onClick={() => setOffset(o => o + 1)}
            className="p-1 text-text-muted hover:text-accent transition-colors rounded-lg hover:bg-accent/10"
            title="Next quote"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  )
}
