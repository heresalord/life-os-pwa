import { useState, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useInboxQuery } from '../../hooks/useInboxQuery'
import { useInboxMutations } from '../../hooks/useInboxMutations'
import { useScrollToHighlight } from '../../hooks/useScrollToHighlight'
import { InboxItemCard } from '../../components/inbox/InboxItemCard'
import { EmptyState } from '../../components/EmptyState'
import { InboxListSkeleton } from '../../components/Skeleton'
import { haptic } from '../../lib/haptic'
import { Inbox, Plus, FileText, Lightbulb, AlertTriangle, CheckSquare, Layers } from 'lucide-react'
import clsx from 'clsx'

type FilterType = 'all' | 'thought' | 'idea' | 'worry' | 'todo' | 'other'

const CHIPS: { value: FilterType; label: string; icon: React.ComponentType<any> }[] = [
  { value: 'all',     label: 'All',      icon: Layers },
  { value: 'thought', label: 'Thoughts', icon: FileText },
  { value: 'idea',    label: 'Ideas',    icon: Lightbulb },
  { value: 'worry',   label: 'Worries',  icon: AlertTriangle },
  { value: 'todo',    label: 'Todos',    icon: CheckSquare },
]

export function InboxPage() {
  const { data: items = [], isLoading } = useInboxQuery(false)
  const { deleteItem, addItem } = useInboxMutations()
  const [searchParams] = useSearchParams()
  const highlight = searchParams.get('highlight')

  const [captureText, setCaptureText] = useState('')
  const [activeFilter, setActiveFilter] = useState<FilterType>('all')

  useScrollToHighlight(highlight, !isLoading)

  const handleCaptureSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!captureText.trim()) return
    haptic('success')
    addItem.mutate(captureText.trim())
    setCaptureText('')
  }

  const filteredItems = useMemo(() => {
    if (activeFilter === 'all') return items
    return items.filter(item => item.type === activeFilter)
  }, [items, activeFilter])

  return (
    <div className="space-y-5 lg:max-w-4xl">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-display text-text">
            {items.length > 0 ? `${items.length} to process` : 'Inbox'}
          </h1>
          <p className="text-xs text-text-muted mt-0.5">Capture and process your thoughts.</p>
        </div>
      </header>

      {/* Quick capture — styled as integrated bar */}
      <form onSubmit={handleCaptureSubmit} className="flex items-center gap-2 bg-surface border border-border rounded-2xl px-4 py-3 focus-within:border-accent transition-colors">
        <Plus size={18} className="text-text-muted flex-shrink-0" />
        <input
          type="text"
          placeholder="Capture a thought, idea, or task..."
          value={captureText}
          onChange={e => setCaptureText(e.target.value)}
          className="flex-1 bg-transparent text-sm text-text placeholder-text-muted outline-none"
        />
        {captureText && (
          <button
            type="submit"
            disabled={!captureText.trim() || addItem.isPending}
            className="text-accent text-xs font-semibold disabled:opacity-50"
          >
            Add
          </button>
        )}
      </form>

      {/* Filter Chips */}
      {items.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none snap-x -mx-4 px-4 sm:mx-0 sm:px-0">
          {CHIPS.map(c => {
            const Icon = c.icon
            const isActive = activeFilter === c.value
            return (
              <button
                key={c.value}
                onClick={() => { haptic('light'); setActiveFilter(c.value) }}
                className={clsx(
                  'flex items-center gap-2 px-3 py-2 rounded-full text-xs font-semibold border transition-all flex-shrink-0 snap-start',
                  isActive
                    ? 'border-accent text-accent bg-accent/10 shadow-sm'
                    : 'border-border text-text-muted bg-surface hover:text-text hover:border-text-secondary'
                )}
              >
                <Icon size={12} />
                <span>{c.label}</span>
              </button>
            )
          })}
        </div>
      )}

      {isLoading ? (
        <InboxListSkeleton count={6} />
      ) : filteredItems.length === 0 && activeFilter === 'all' && items.length === 0 ? (
        // Inbox Zero state
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="text-5xl mb-4">🎉</div>
          <h2 className="font-display text-2xl font-bold text-text mb-2">Inbox Zero</h2>
          <p className="text-text-muted text-sm max-w-xs">
            Nothing to process. Your mind is clear.
          </p>
        </div>
      ) : filteredItems.length === 0 ? (
        <EmptyState
          icon={<Inbox size={40} />}
          title={activeFilter === 'all' ? "Inbox is clear" : "No items matches filter"}
          message={activeFilter === 'all' ? "Capture thoughts using the bar above." : "Try switching to another filter tab."}
        />
      ) : (
        // ── Desktop: 2-column card grid; mobile: single column ──
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {filteredItems.map(item => (
            <div key={item.id} data-item-id={item.id} className="rounded-2xl">
              <InboxItemCard
                item={item as any}
                onDelete={(id) => deleteItem.mutate(id)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
