import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Quote, ChevronRight, ChevronLeft } from 'lucide-react'
import { useQuotesQuery } from '../../../hooks/useQuotesQuery'
import { useAppStore } from '../../../store/useAppStore'

export function QuoteWidget() {
  const navigate = useNavigate()
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

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation()
    setOffset(o => o - 1)
  }

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation()
    setOffset(o => o + 1)
  }

  return (
    <div
      onClick={() => navigate('/books')}
      className="bg-surface border border-border rounded-2xl p-4.5 flex flex-col justify-between h-full cursor-pointer hover:border-accent/40 hover:shadow-sm transition-all group"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2.5 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Quote size={14} className="text-accent group-hover:scale-110 transition-transform" />
          <span className="font-semibold text-text uppercase tracking-wider text-[11px]">Quote of the Day</span>
        </div>
        <span className="text-[10px] text-text-muted bg-surface-2 px-2 py-0.5 rounded-full">
          rotates {quoteIntervalHours}h
        </span>
      </div>

      {/* Quote display */}
      <div className="flex-1 flex flex-col justify-between gap-2 overflow-y-auto">
        {quotes.length === 0 ? (
          <p className="text-xs text-text-muted italic leading-relaxed py-4 my-auto text-center">
            "No quotes saved yet — tap the speech bubble on any book to save a passage."
          </p>
        ) : (
          <>
            <blockquote className="text-xs text-text-secondary leading-relaxed italic my-auto font-medium pl-2.5 border-l-2 border-accent/30">
              "{quote.text}"
            </blockquote>
            
            {/* Attribution */}
            {(quote.book_title || quote.book_author) && (
              <p className="text-[10px] text-text-muted pl-2.5">
                — {quote.book_author ? `${quote.book_author}` : ''}{quote.book_author && quote.book_title ? ', ' : ''}{quote.book_title ? <em>{quote.book_title}</em> : ''}
                {quote.page ? ` · p. ${quote.page}` : ''}
              </p>
            )}

            {/* Navigation (Only show if multiple quotes) */}
            {quotes.length > 1 && (
              <div className="flex items-center justify-between pt-2.5 border-t border-border/40 flex-shrink-0">
                <button
                  onClick={handlePrev}
                  className="p-1 text-text-muted hover:text-accent transition-colors rounded-lg hover:bg-accent/10"
                  title="Previous quote"
                >
                  <ChevronLeft size={13} />
                </button>
                <span className="text-[9px] text-text-muted font-semibold">
                  {currentIndex + 1} / {quotes.length}
                </span>
                <button
                  onClick={handleNext}
                  className="p-1 text-text-muted hover:text-accent transition-colors rounded-lg hover:bg-accent/10"
                  title="Next quote"
                >
                  <ChevronRight size={13} />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
