import { useSearchParams } from 'react-router-dom'
import { useInboxQuery } from '../../hooks/useInboxQuery'
import { useInboxMutations } from '../../hooks/useInboxMutations'
import { useScrollToHighlight } from '../../hooks/useScrollToHighlight'
import { InboxItemCard } from '../../components/inbox/InboxItemCard'
import { EmptyState } from '../../components/EmptyState'
import { Inbox } from 'lucide-react'

export function InboxPage() {
  const { data: items = [], isLoading } = useInboxQuery(false)
  const { deleteItem } = useInboxMutations()
  const [searchParams] = useSearchParams()
  const highlight = searchParams.get('highlight')

  useScrollToHighlight(highlight, !isLoading)

  return (
    <div className="space-y-6 lg:max-w-4xl">
      <header>
        <h1 className="text-2xl font-display text-text">Inbox</h1>
        <p className="text-sm text-text-secondary mt-1">Process captured thoughts and ideas.</p>
      </header>

      {isLoading ? (
        <div className="flex justify-center p-8">
          <div className="w-6 h-6 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Inbox size={40} />}
          title="Inbox is clear"
          message="Capture thoughts using the + button. They'll appear here to process."
        />
      ) : (
        // ── Desktop: 2-column card grid; mobile: single column ──
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {items.map(item => (
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
